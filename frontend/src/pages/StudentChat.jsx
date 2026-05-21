import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { pct } from "../lib/format";
import SourcesList from "../components/SourcesList.jsx";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-lg px-4 py-3 text-[14px] leading-relaxed shadow-sm",
          isUser
            ? "bg-navy text-white"
            : "bg-white text-slate-900 border border-slate-200",
        ].join(" ")}
      >
        {msg.escalated && !isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="tag tag-amber">Escalated</span>
            <span className="text-[11px] text-slate-500">
              forwarded to your instructor
            </span>
          </div>
        )}
        {msg.routed === "student" && !isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="tag tag-teal">Routine</span>
            <span className="text-[11px] text-slate-500">
              answered from course materials · confidence {pct(msg.confidence)}
            </span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              From
            </p>
            <ul className="flex flex-col gap-1">
              {msg.sources.map((s, i) => (
                <li key={`${s.source}-${s.chunk_index}-${i}`} className="flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-slate-400">[{i + 1}]</span>
                  <span className="font-semibold text-navy truncate">{s.source}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 capitalize">{s.doc_type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!isUser && msg.reasoning && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-mono text-slate-400 hover:text-slate-600">
              classifier reasoning
            </summary>
            <p className="mt-1 text-[12px] text-slate-500 italic">
              {msg.reasoning}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}

export default function StudentChat() {
  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: "assistant",
      text:
        "Hi! I'm Megatron, your course AI assistant. Ask me anything about deadlines, " +
        "the syllabus, rubrics, or how an assignment works. If your question needs " +
        "your instructor, I'll forward it to them with context.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useMemo(() => uid(), []);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((m) => [...m, { id: uid(), role: "user", text }]);
    setBusy(true);
    try {
      const res = await api.ask(text, sessionId);
      const replyText = res.answer
        ? res.answer
        : `Thanks — I've forwarded this to your instructor. You'll get a reply on the dashboard once they respond.`;
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: replyText,
          escalated: res.escalated,
          routed: res.routed_to,
          confidence: res.confidence,
          sources: res.sources,
          reasoning: res.reasoning,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: `⚠️ Couldn't reach the backend: ${err.message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <section className="panel p-0 flex flex-col h-[calc(100vh-200px)]">
        <header className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-xl text-navy">Ask a question</h2>
          <p className="text-sm text-slate-500">
            Routine questions are answered instantly. Substantive ones go to
            your instructor.
          </p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 bg-slate-50">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-500">
                <span className="inline-block animate-pulse">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <footer className="px-5 py-3 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="e.g. When is problem set 3 due?"
              className="flex-1 resize-none rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-navy"
              disabled={busy}
            />
            <button
              onClick={send}
              disabled={busy || !draft.trim()}
              className="btn-primary"
            >
              Send
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            Enter to send · Shift+Enter for a new line
          </p>
        </footer>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="panel">
          <h3 className="panel-head">How this works</h3>
          <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-2">
            <li>Your question is matched against course materials.</li>
            <li>An LLM classifies it as routine or substantive.</li>
            <li>
              Routine → instant grounded answer. Substantive → instructor
              dashboard.
            </li>
          </ol>
        </div>
        <div className="panel bg-bluex-soft border-bluex/30">
          <h3 className="panel-head" style={{ borderColor: "#1862a8", color: "#1862a8" }}>
            Try asking
          </h3>
          <ul className="text-sm text-slate-700 space-y-1">
            <li>“When is the next assignment due?”</li>
            <li>“What's the late policy?”</li>
            <li>“How is participation weighted?”</li>
            <li>
              “Can I get an extension because I'm sick?” <em>(escalates)</em>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
