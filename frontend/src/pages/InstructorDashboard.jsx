import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatTime, pct } from "../lib/format";
import SourcesList from "../components/SourcesList.jsx";

function StatusBadge({ status }) {
  return status === "pending" ? (
    <span className="tag tag-amber">Pending</span>
  ) : (
    <span className="tag tag-teal">Answered</span>
  );
}

function EscalationCard({ item, onAnswer, onDelete }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.answerEscalation(item.id, draft.trim());
      setDraft("");
      onAnswer();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteEscalation(item.id);
      onDelete(item.id);
    } catch (e) {
      setError(e.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="panel">
      <header className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={item.status} />
            <span className="tag tag-violet">{item.intent}</span>
            <span className="font-mono text-[11px] text-slate-500">
              confidence {pct(item.confidence)} · {formatTime(item.created_at)}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-navy leading-snug">
            {item.question}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs rounded border border-rose-300 text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Classifier reasoning
          </h4>
          <p className="text-sm text-slate-700 italic">{item.reasoning}</p>
        </div>
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Related course material
          </h4>
          <SourcesList sources={item.sources} compact />
        </div>
      </div>

      {item.status === "pending" ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <label className="block text-sm font-semibold text-navy mb-1">
            Your answer
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-navy"
            placeholder="Reply to the student. They'll see this in their chat history."
          />
          {error && (
            <p className="text-sm text-rose-600 mt-1">Error: {error}</p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="btn-primary"
              onClick={submit}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Sending…" : "Send to student"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Instructor reply · {formatTime(item.answered_at)}
          </h4>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {item.instructor_answer}
          </p>
        </div>
      )}
    </article>
  );
}

export default function InstructorDashboard() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.listEscalations(filter === "all" ? null : filter);
      setItems(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl text-navy">
            Escalation queue
          </h2>
          <p className="text-sm text-slate-500">
            Questions the AI flagged as substantive. Each item arrives with the
            classifier's reasoning and relevant excerpts from your materials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["pending", "answered", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition",
                filter === f
                  ? "bg-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="tag tag-amber">{pendingCount} pending</span>
        <span>·</span>
        <span>Auto-refreshes every 10s</span>
        {loading && <span className="italic">refreshing…</span>}
      </div>

      {err && (
        <div className="panel border-rose-300 bg-rose-50 text-rose-700">
          Couldn't load escalations: {err}
        </div>
      )}

      {!loading && items.length === 0 && !err && (
        <div className="panel text-slate-500 text-center py-12">
          No escalations in this view. The AI is handling everything so far.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <EscalationCard
            key={it.id}
            item={it}
            onAnswer={load}
            onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
