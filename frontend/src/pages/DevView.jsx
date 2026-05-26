import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatTime, pct } from "../lib/format";

const RATING_LABELS = {
  thumbs_up: { emoji: "👍", label: "Helpful", color: "text-emerald-600" },
  neutral: { emoji: "😐", label: "Okay", color: "text-amber-500" },
  thumbs_down: { emoji: "👎", label: "Wrong", color: "text-rose-600" },
};

function RouteBadge({ routed }) {
  return routed === "student" ? (
    <span className="tag tag-teal">Answered by AI</span>
  ) : (
    <span className="tag tag-amber">Escalated</span>
  );
}

function IntentBadge({ intent }) {
  return intent === "routine" ? (
    <span className="tag tag-bluex">Routine</span>
  ) : (
    <span className="tag tag-violet">Substantive</span>
  );
}

function QuestionRow({ item, feedback, escalationFeedback }) {
  const [open, setOpen] = useState(false);
  const r = feedback ? (RATING_LABELS[feedback.rating] ?? { emoji: "?", label: feedback.rating, color: "text-slate-500" }) : null;
  const er = escalationFeedback ? (RATING_LABELS[escalationFeedback.rating] ?? { emoji: "?", label: escalationFeedback.rating, color: "text-slate-500" }) : null;

  return (
    <article className="panel py-3">
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <RouteBadge routed={item.routed_to} />
            <IntentBadge intent={item.intent} />
            <span className="font-mono text-[11px] text-slate-500">
              confidence {pct(item.confidence)}
            </span>
            <span className="font-mono text-[11px] text-slate-400">·</span>
            <span className="font-mono text-[11px] text-slate-400">
              {formatTime(item.created_at)}
            </span>
            {item.session_id && (
              <>
                <span className="font-mono text-[11px] text-slate-400">·</span>
                <span className="font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                  session {item.session_id}
                </span>
              </>
            )}
            {r && (
              <span className={`font-mono text-[11px] font-medium ${r.color}`}>
                · {r.emoji} {r.label}
              </span>
            )}
            {er && (
              <span className={`font-mono text-[11px] font-medium ${er.color}`}>
                · {er.emoji} {er.label} <span className="text-slate-400 font-normal">(instructor)</span>
              </span>
            )}
          </div>
          <p className="text-[14px] text-slate-900 leading-snug">
            {item.question}
          </p>
        </div>
        <span className="text-slate-400 text-xs shrink-0 mt-1">
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3 grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Classifier reasoning
            </h4>
            <p className="text-sm text-slate-700 italic">
              {item.reasoning || <span className="text-slate-400">—</span>}
            </p>
          </div>
          {item.answer && (
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Answer given
              </h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {item.answer}
              </p>
            </div>
          )}
          {feedback && (
            <div className="md:col-span-2 border-t border-slate-100 pt-3">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Student feedback
              </h4>
              <div className={`flex items-center gap-1.5 font-medium ${r.color}`}>
                <span className="text-base">{r.emoji}</span>
                <span className="text-sm">{r.label}</span>
              </div>
              {feedback.comment && (
                <p className="mt-1 text-sm text-slate-700 italic">"{feedback.comment}"</p>
              )}
            </div>
          )}
          {escalationFeedback && (
            <div className="md:col-span-2 border-t border-slate-100 pt-3">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Instructor feedback
              </h4>
              <div className={`flex items-center gap-1.5 font-medium ${er.color}`}>
                <span className="text-base">{er.emoji}</span>
                <span className="text-sm">{er.label}</span>
              </div>
              {escalationFeedback.comment && (
                <p className="mt-1 text-sm text-slate-700 italic">"{escalationFeedback.comment}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function DevView() {
  const [items, setItems] = useState([]);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [escalationFeedbackMap, setEscalationFeedbackMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [questions, feedback, escalationFeedback] = await Promise.all([
        api.listQuestions(200),
        api.listFeedback(),
        api.listEscalationFeedback(),
      ]);
      setItems(questions);
      setFeedbackMap(Object.fromEntries(feedback.map((f) => [f.question_id, f])));
      setEscalationFeedbackMap(Object.fromEntries(escalationFeedback.map((f) => [f.question_id, f])));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const filtered =
    filter === "all"
      ? items
      : items.filter((i) => i.routed_to === filter);

  const counts = {
    all: items.length,
    student: items.filter((i) => i.routed_to === "student").length,
    instructor: items.filter((i) => i.routed_to === "instructor").length,
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl text-navy">Question log</h2>
          <p className="text-sm text-slate-500">
            All questions with routing decisions and student feedback. Auto-refreshes every 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: `All (${counts.all})` },
            { key: "student", label: `AI answered (${counts.student})` },
            { key: "instructor", label: `Escalated (${counts.instructor})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={[
                "px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition",
                filter === key
                  ? "bg-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        {loading && <span className="italic">refreshing…</span>}
      </div>

      {err && (
        <div className="panel border-rose-300 bg-rose-50 text-rose-700">
          Couldn't load questions: {err}
        </div>
      )}

      {!loading && filtered.length === 0 && !err && (
        <div className="panel text-slate-500 text-center py-12">
          No questions yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <QuestionRow
            key={item.id}
            item={item}
            feedback={feedbackMap[item.id] ?? null}
            escalationFeedback={escalationFeedbackMap[item.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
