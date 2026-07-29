import { useCallback, useEffect, useRef, useState } from "react";
import {
  askQuestion,
  attachDocument,
  createSession,
  deleteSession,
  detachDocument,
  getDocumentStatus,
  getSession,
  listSessions,
  renameSession,
  uploadDocument,
} from "../api/client";

const ACTIVE_KEY = "documind_active_session";
const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

/** Drives the sidebar (list of conversations) and the active conversation's chat state.
 * The backend (Postgres) is the source of truth; localStorage only remembers which
 * conversation was last open, as a convenience across refreshes. */
export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const activeIdRef = useRef(null);
  const creatingRef = useRef(false);
  const pollsRef = useRef(new Set());

  // Document-status polls outlive the request that started them, so they have to be cleaned
  // up explicitly — otherwise they keep firing after the app unmounts.
  useEffect(
    () => () => {
      pollsRef.current.forEach((id) => clearInterval(id));
      pollsRef.current.clear();
    },
    []
  );

  const stopPoll = useCallback((id) => {
    clearInterval(id);
    pollsRef.current.delete(id);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await listSessions();
      setConversations(list);
      return list;
    } catch (e) {
      setError(e.message);
      return [];
    }
  }, []);

  /** `silent` refreshes in place — used after attaching/removing a document so the open
   *  transcript isn't replaced by a loading state it doesn't need. */
  const loadConversation = useCallback(async (id, { silent = false } = {}) => {
    activeIdRef.current = id;
    if (!silent) setIsLoadingActive(true);
    try {
      const detail = await getSession(id);
      if (activeIdRef.current === id) setActiveSession(detail);
    } catch (e) {
      if (activeIdRef.current === id) {
        setError(e.message);
        if (!silent) setActiveSession(null);
      }
    } finally {
      if (!silent && activeIdRef.current === id) setIsLoadingActive(false);
    }
  }, []);

  const selectConversation = useCallback(
    (id) => {
      setError(null);
      setActiveId(id);
      localStorage.setItem(ACTIVE_KEY, id);
      loadConversation(id);
    },
    [loadConversation]
  );

  // Initial load: fetch the sidebar, restore the last-open conversation if it still exists.
  useEffect(() => {
    (async () => {
      const list = await refreshList();
      setIsLoadingList(false);
      const stored = localStorage.getItem(ACTIVE_KEY);
      if (stored && list.some((s) => s.id === stored)) {
        selectConversation(stored);
      }
    })();
  }, [refreshList, selectConversation]);

  const createNewConversation = useCallback(async () => {
    // Without this, impatient double-clicks each create their own empty conversation.
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);
    try {
      const { session_id } = await createSession();
      await refreshList();
      selectConversation(session_id);
    } catch (e) {
      setError(e.message);
    } finally {
      creatingRef.current = false;
    }
  }, [refreshList, selectConversation]);

  const deleteConversation = useCallback(
    async (id) => {
      setError(null);
      try {
        await deleteSession(id);
        if (activeIdRef.current === id) {
          activeIdRef.current = null;
          setActiveId(null);
          setActiveSession(null);
          localStorage.removeItem(ACTIVE_KEY);
        }
        await refreshList();
      } catch (e) {
        setError(e.message);
      }
    },
    [refreshList]
  );

  const renameConversation = useCallback(
    async (id, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      // Optimistic — a rename is trivially reversible, so don't make the user wait for it.
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
      setActiveSession((prev) => (prev && prev.id === id ? { ...prev, title: trimmed } : prev));
      try {
        const updated = await renameSession(id, trimmed);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
        );
      } catch (e) {
        setError(e.message);
        refreshList();
      }
    },
    [refreshList]
  );

  const removeDocument = useCallback(
    async (documentId) => {
      if (!activeId) return;
      const targetId = activeId;
      setError(null);
      try {
        await detachDocument(targetId, documentId);
        await loadConversation(targetId, { silent: true });
        refreshList();
      } catch (e) {
        setError(e.message);
      }
    },
    [activeId, loadConversation, refreshList]
  );

  const sendMessage = useCallback(
    async (question) => {
      const trimmed = question.trim();
      if (!trimmed || !activeId || isAsking) return;

      const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
      setError(null);
      setActiveSession((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { role: "user", content: trimmed, created_at: new Date().toISOString(), _localId: optimisticId },
              ],
            }
          : prev
      );
      setIsAsking(true);
      try {
        const res = await askQuestion(activeId, trimmed);
        setActiveSession((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    role: "assistant",
                    content: res.answer,
                    sources: res.sources,
                    created_at: new Date().toISOString(),
                  },
                ],
              }
            : prev
        );
        refreshList();
      } catch (e) {
        setError(e.message);
        // The backend never persisted anything for this turn (it only writes messages
        // after answer_question succeeds) — drop the optimistic bubble so the UI doesn't
        // show a question that will silently vanish the next time this conversation loads.
        setActiveSession((prev) =>
          prev
            ? { ...prev, messages: prev.messages.filter((m) => m._localId !== optimisticId) }
            : prev
        );
      } finally {
        setIsAsking(false);
      }
    },
    [activeId, isAsking, refreshList]
  );

  const addDocument = useCallback(
    async (file) => {
      if (!activeId) return;
      const targetId = activeId;
      setError(null);
      setIsUploading(true);
      try {
        const uploaded = await uploadDocument(file);
        await attachDocument(targetId, uploaded.document_id);
        await loadConversation(targetId, { silent: true });
        refreshList();

        let consecutiveFailures = 0;
        const poll = setInterval(async () => {
          try {
            const status = await getDocumentStatus(uploaded.document_id);
            consecutiveFailures = 0;
            if (status.status !== "processing") {
              stopPoll(poll);
              if (activeIdRef.current === targetId) {
                await loadConversation(targetId, { silent: true });
              }
              refreshList();
            }
          } catch {
            // A single dropped request shouldn't stop tracking a document that's still
            // processing — only give up after several *consecutive* failures, which
            // signals a real outage rather than one blip.
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
              stopPoll(poll);
              setError("Lost track of a document's processing status. Refresh to check on it.");
            }
          }
        }, POLL_INTERVAL_MS);
        pollsRef.current.add(poll);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsUploading(false);
      }
    },
    [activeId, loadConversation, refreshList, stopPoll]
  );

  // The list is refetched after every answer, and the backend names a conversation from its
  // first question — so read the title from the list to pick that up without another fetch.
  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title ?? activeSession?.title ?? null;

  return {
    conversations,
    isLoadingList,
    activeId,
    activeSession,
    activeTitle,
    isLoadingActive,
    isAsking,
    isUploading,
    error,
    selectConversation,
    createNewConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    addDocument,
    removeDocument,
    dismissError: () => setError(null),
  };
}
