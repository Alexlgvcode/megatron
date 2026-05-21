import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { pct } from "../lib/format";
import SourcesList from "../components/SourcesList.jsx";

const POLL_INTERVAL_MS = 8000;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function EscalatedPanel({ escalations }) {
  const entries = Object.entries(escalations);
  if (entries.length === 0) return null;
  return (
    <div className="panel">
      <h3 className="panel-head">Escalated Questions</h3>
      <div className="flex flex-col gap-3">
        {entries.map(([id, esc]) => (
          <div key={id} className="text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <p className="font-medium text-slate-800 line-clamp-2">{esc.question}</p>
            {esc.status === "pending" ? (
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                Waiting for reply…
              </div>
            ) : (
              <div className="mt-2">
                <span className="tag tag-teal text-[11px]">Instructor reply</span>
                <p className="mt-1 text-slate-700 whitespace-pre-wrap">{esc.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const RATING_OPTIONS = [
  { value: "thumbs_up", emoji: "👍", label: "Helpful" },
  { value: "neutral", emoji: "😐", label: "Okay" },
  { value: "thumbs_down", emoji: "👎", label: "Wrong" },
];

function FeedbackWidget({ questionId, sessionId }) {
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({ questionId, rating: selected, comment: comment.trim() || null, sessionId });
      setSubmitted(true);
    } catch {
      // silently ignore — feedback is best-effort
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-2 text-[12px] text-slate-400 italic">
        Thanks for your feedback
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="text-[11px] text-slate-400 mb-1.5">Was this answer helpful?</p>
      <div className="flex gap-1.5">
        {RATING_OPTIONS.map(({ value, emoji, label }) => (
          <button
            key={value}
            onClick={() => setSelected(selected === value ? null : value)}
            title={label}
            className={[
              "text-base px-2.5 py-0.5 rounded border transition",
              selected === value
                ? "border-navy bg-navy/10"
                : "border-slate-200 hover:border-slate-400",
            ].join(" ")}
          >
            {emoji}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional: anything to add?"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-[12px] focus:outline-none focus:border-navy resize-none"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-1 text-[12px] px-3 py-1 bg-navy text-white rounded hover:bg-navy/90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, sessionId }) {
  const isUser = msg.role === "user";
  const showFeedback = !isUser && msg.question_id && !msg.escalated && msg.routed === "student";
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
        {msg.instructorReply && !isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="tag tag-teal">Instructor reply</span>
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
        {showFeedback && (
          <FeedbackWidget questionId={msg.question_id} sessionId={sessionId} />
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
  // { [escalation_id]: { question, status, answer } }
  const [escalations, setEscalations] = useState({});
  const sessionId = useMemo(() => uid(), []);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pendingIds = Object.entries(escalations)
    .filter(([, v]) => v.status === "pending")
    .map(([id]) => Number(id));

  // Poll for instructor replies on any pending escalations.
  useEffect(() => {
    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const escalation_id of pendingIds) {
        try {
          const esc = await api.getEscalation(escalation_id);
          if (esc.status === "answered" && esc.instructor_answer) {
            setEscalations((prev) => ({
              ...prev,
              [escalation_id]: {
                ...prev[escalation_id],
                status: "answered",
                answer: esc.instructor_answer,
              },
            }));
            setMessages((m) => [
              ...m,
              {
                id: uid(),
                role: "assistant",
                text: "Your instructor replied — see the panel on the right.",
                instructorNotification: true,
              },
            ]);
          }
        } catch {
          // If the escalation was deleted or unreachable, stop polling it
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds.join(",")]);

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
        : `Your question has been forwarded to your instructor. Their reply will appear in the panel on the right.`;
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: replyText,
          question_id: res.question_id,
          escalated: res.escalated,
          routed: res.routed_to,
          confidence: res.confidence,
          sources: res.sources,
          reasoning: res.reasoning,
        },
      ]);
      if (res.escalated && res.escalation_id != null) {
        setEscalations((prev) => ({
          ...prev,
          [res.escalation_id]: { question: text, status: "pending", answer: null },
        }));
      }
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
            <MessageBubble key={m.id} msg={m} sessionId={sessionId} />
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
        <EscalatedPanel escalations={escalations} />
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
            <li>"When is the next assignment due?"</li>
            <li>"What's the late policy?"</li>
            <li>"How is participation weighted?"</li>
            <li>
              "Can I get an extension because I'm sick?" <em>(escalates)</em>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
