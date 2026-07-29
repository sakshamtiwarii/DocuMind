import { useCallback, useEffect, useRef, useState } from "react";
import {
  askQuestion,
  createSession,
  getDocumentStatus,
  getSessionMessages,
  uploadDocument,
} from "../api/client";

const DOC_KEY = "documind_document_id";
const SESSION_KEY = "documind_session_id";
const POLL_INTERVAL_MS = 2000;

function normalizeDocument(raw, fallbackFilename) {
  return {
    id: raw.document_id,
    filename: raw.filename ?? fallbackFilename,
    status: raw.status,
    page_count: raw.page_count ?? null,
  };
}

/** Drives the upload -> processing -> chat flow and persists it across refreshes. */
export function useDocuMind() {
  const [screen, setScreen] = useState("restoring");
  const [document, setDocument] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [isAsking, setIsAsking] = useState(false);
  const startingSession = useRef(false);

  const startSession = useCallback(async (documentId) => {
    if (startingSession.current) return;
    startingSession.current = true;
    try {
      const s = await createSession(documentId);
      localStorage.setItem(SESSION_KEY, s.session_id);
      setSession({ id: s.session_id });
      setMessages([]);
      setScreen("chat");
    } catch (e) {
      setError(e.message);
    } finally {
      startingSession.current = false;
    }
  }, []);

  // Restore state from localStorage on first load.
  useEffect(() => {
    const storedDocId = localStorage.getItem(DOC_KEY);
    if (!storedDocId) {
      setScreen("upload");
      return;
    }

    (async () => {
      try {
        const doc = normalizeDocument(await getDocumentStatus(storedDocId));
        setDocument(doc);

        if (doc.status === "ready") {
          const storedSessionId = localStorage.getItem(SESSION_KEY);
          if (!storedSessionId) {
            await startSession(doc.id);
            return;
          }
          try {
            const history = await getSessionMessages(storedSessionId);
            setSession({ id: storedSessionId });
            setMessages(history);
            setScreen("chat");
          } catch {
            await startSession(doc.id);
          }
        } else {
          // 'processing' or 'failed' — ProcessingScreen handles both.
          setScreen("processing");
        }
      } catch (e) {
        if (e.status === 404) {
          localStorage.removeItem(DOC_KEY);
          localStorage.removeItem(SESSION_KEY);
          setScreen("upload");
        } else {
          setError(e.message);
          setScreen("upload");
        }
      }
    })();
  }, [startSession]);

  // Poll ingestion status while a document is processing.
  useEffect(() => {
    if (screen !== "processing" || !document || document.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const updated = normalizeDocument(
          await getDocumentStatus(document.id),
          document.filename
        );
        setDocument(updated);
        if (updated.status === "ready") {
          clearInterval(interval);
          await startSession(updated.id);
        } else if (updated.status === "failed") {
          clearInterval(interval);
        }
      } catch (e) {
        clearInterval(interval);
        setError(e.message);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [screen, document, startSession]);

  const uploadFile = useCallback(async (file) => {
    setError(null);
    try {
      const res = await uploadDocument(file);
      localStorage.setItem(DOC_KEY, res.document_id);
      localStorage.removeItem(SESSION_KEY);
      setDocument(normalizeDocument(res, file.name));
      setSession(null);
      setMessages([]);
      setScreen("processing");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const sendMessage = useCallback(
    async (question) => {
      const trimmed = question.trim();
      if (!trimmed || !document || !session || isAsking) return;

      setError(null);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, created_at: new Date().toISOString() },
      ]);
      setIsAsking(true);
      try {
        const res = await askQuestion(document.id, session.id, trimmed);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.answer,
            sources: res.sources,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsAsking(false);
      }
    },
    [document, session, isAsking]
  );

  const newDocument = useCallback(() => {
    localStorage.removeItem(DOC_KEY);
    localStorage.removeItem(SESSION_KEY);
    setDocument(null);
    setSession(null);
    setMessages([]);
    setError(null);
    setScreen("upload");
  }, []);

  return {
    screen,
    document,
    messages,
    error,
    isAsking,
    uploadFile,
    sendMessage,
    newDocument,
    dismissError: () => setError(null),
  };
}
