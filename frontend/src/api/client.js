const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

const STATUS_MESSAGES = {
  400: "That request wasn't valid.",
  404: "Not found — it may have been removed.",
  409: "The document is still being processed. Hang tight.",
  422: "This document failed to process. Please re-upload it.",
  502: "The AI service is having trouble. Try again in a moment.",
  503: "The vector database is unreachable. Try again in a moment.",
};

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new AppError("Can't reach the server. Is the backend running?", 0);
  }

  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      // response wasn't JSON — fall back to the generic status message
    }
    throw new AppError(
      detail || STATUS_MESSAGES[res.status] || `Request failed (${res.status})`,
      res.status
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

function json(path, body, method = "POST") {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/documents", { method: "POST", body: formData });
}

export function getDocumentStatus(documentId) {
  return request(`/documents/${documentId}`);
}

export function createSession() {
  return request("/sessions", { method: "POST" });
}

export function listSessions() {
  return request("/sessions");
}

export function getSession(sessionId) {
  return request(`/sessions/${sessionId}`);
}

export function attachDocument(sessionId, documentId) {
  return json(`/sessions/${sessionId}/documents`, { document_id: documentId });
}

export function renameSession(sessionId, title) {
  return json(`/sessions/${sessionId}`, { title }, "PATCH");
}

export function detachDocument(sessionId, documentId) {
  return request(`/sessions/${sessionId}/documents/${documentId}`, { method: "DELETE" });
}

export function deleteSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: "DELETE" });
}

export function askQuestion(sessionId, question) {
  return json("/ask", { session_id: sessionId, question });
}
