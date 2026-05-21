import { pct } from "../lib/format";

const DOC_TYPE_TAG = {
  syllabus: "tag-bluex",
  rubric: "tag-violet",
  assignment: "tag-teal",
  faq: "tag-amber",
  other: "tag-navy",
};

export default function SourcesList({ sources = [], compact = false }) {
  if (!sources.length) {
    return (
      <div className="text-sm text-slate-500">No retrieved sources.</div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {sources.map((s, i) => (
        <li
          key={`${s.source}-${s.chunk_index}-${i}`}
          className="rounded border border-slate-200 bg-slate-50 p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] text-slate-500">
              [{i + 1}]
            </span>
            <span className="text-sm font-semibold text-navy truncate">
              {s.source}
            </span>
            <span className={`tag ${DOC_TYPE_TAG[s.doc_type] || "tag-navy"}`}>
              {s.doc_type}
            </span>
            <span className="ml-auto font-mono text-[11px] text-slate-500">
              sim {pct(s.score)}
            </span>
          </div>
          {!compact && (
            <p className="text-[13px] text-slate-700 leading-snug whitespace-pre-wrap line-clamp-4">
              {s.text}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
