import { useCallback, useEffect, useRef, useState } from "react";
import {
  askQuestion,
  attachDocument,
  createSession,
  deleteSession,
  getDocumentStatus,
  getSession,
  listSessions,
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

  const loadConversation = useCallback(async (id) => {
    activeIdRef.current = id;
    setIsLoadingActive(true);
    try {
      const detail = await getSession(id);
      if (activeIdRef.current === id) setActiveSession(detail);
    } catch (e) {
      if (activeIdRef.current === id) {
        setError(e.message);
        setActiveSession(null);
      }
    } finally {
      if (activeIdRef.current === id) setIsLoadingActive(false);
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
    setError(null);
    try {
      const { session_id } = await createSession();
      await refreshList();
      selectConversation(session_id);
    } catch (e) {
      setError(e.message);
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
        await loadConversation(targetId);
        refreshList();

        let consecutiveFailures = 0;
        const poll = setInterval(async () => {
          try {
            const status = await getDocumentStatus(uploaded.document_id);
            consecutiveFailures = 0;
            if (status.status !== "processing") {
              clearInterval(poll);
              if (activeIdRef.current === targetId) await loadConversation(targetId);
              refreshList();
            }
          } catch {
            // A single dropped request shouldn't stop tracking a document that's still
            // processing — only give up after several *consecutive* failures, which
            // signals a real outage rather than one blip.
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
              clearInterval(poll);
              setError("Lost track of a document's processing status. Refresh to check on it.");
            }
          }
        }, POLL_INTERVAL_MS);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsUploading(false);
      }
    },
    [activeId, loadConversation, refreshList]
  );

  return {
    conversations,
    isLoadingList,
    activeId,
    activeSession,
    isLoadingActive,
    isAsking,
    isUploading,
    error,
    selectConversation,
    createNewConversation,
    deleteConversation,
    sendMessage,
    addDocument,
    dismissError: () => setError(null),
  };
}
