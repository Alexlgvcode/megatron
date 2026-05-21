// Thin fetch wrapper. The Vite dev server proxies /api -> http://localhost:8000
// (see vite.config.js), so in dev the frontend can use relative URLs.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch (_) {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/api/health"),

  // chat
  ask: (question, sessionId) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId || null }),
    }),

  // documents
  listDocuments: () => request("/api/documents"),
  uploadDocument: async ({ file, docType, title }) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    if (title) fd.append("title", title);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body && body.detail) msg = body.detail;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  },
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: "DELETE" }),

  // escalations
  listEscalations: (status) =>
    request(`/api/escalations${status ? `?status=${status}` : ""}`),
  answerEscalation: (id, answer) =>
    request(`/api/escalations/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),
  deleteEscalation: (id) =>
    request(`/api/escalations/${id}`, { method: "DELETE" }),

  // log
  listQuestions: (limit = 100) => request(`/api/questions?limit=${limit}`),
};
