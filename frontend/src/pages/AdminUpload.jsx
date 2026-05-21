import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { formatTime } from "../lib/format";

const DOC_TYPES = [
  { value: "syllabus", label: "Syllabus" },
  { value: "rubric", label: "Rubric" },
  { value: "assignment", label: "Assignment" },
  { value: "faq", label: "FAQ" },
  { value: "other", label: "Other" },
];

const TAG = {
  syllabus: "tag-bluex",
  rubric: "tag-violet",
  assignment: "tag-teal",
  faq: "tag-amber",
  other: "tag-navy",
};

export default function AdminUpload() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("syllabus");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.listDocuments();
      setDocs(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await api.uploadDocument({ file, docType, title });
      setUploadMsg(`✓ ${res.message}`);
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      setUploadMsg(`✗ ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    if (!confirm("Remove this document and its embeddings?")) return;
    try {
      await api.deleteDocument(id);
      load();
    } catch (e) {
      alert(`Couldn't delete: ${e.message}`);
    }
  }

  const totalChunks = docs.reduce((a, d) => a + d.chunk_count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="font-display text-2xl text-navy">
            Course materials
          </h2>
          <p className="text-sm text-slate-500">
            Upload syllabus, rubrics, assignment sheets, and FAQs. They're
            chunked, embedded, and indexed in the vector store so the assistant
            can ground its answers.
          </p>
        </header>

        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="tag tag-bluex">{docs.length} documents</span>
          <span className="tag tag-teal">{totalChunks} chunks indexed</span>
          {loading && <span className="italic">loading…</span>}
        </div>

        {err && (
          <div className="panel border-rose-300 bg-rose-50 text-rose-700">
            Couldn't load documents: {err}
          </div>
        )}

        {!loading && docs.length === 0 && !err && (
          <div className="panel text-slate-500 text-center py-12">
            No documents yet. Upload your first course file →
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li key={d.id} className="panel py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`tag ${TAG[d.doc_type] || "tag-navy"}`}>
                    {d.doc_type}
                  </span>
                  <span className="text-sm font-semibold text-navy truncate">
                    {d.title}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 truncate">
                  {d.filename} · {d.chunk_count} chunks ·{" "}
                  {formatTime(d.uploaded_at)}
                </div>
              </div>
              <button onClick={() => remove(d.id)} className="btn-ghost">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside>
        <form onSubmit={upload} className="panel flex flex-col gap-3 sticky top-4">
          <h3 className="panel-head">Upload a document</h3>

          <label className="text-sm font-semibold text-navy">
            File
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block mt-1 w-full text-sm"
              required
            />
            <span className="block mt-1 font-mono text-[10px] text-slate-400">
              .pdf, .txt, or .md
            </span>
          </label>

          <label className="text-sm font-semibold text-navy">
            Type
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="block mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-navy">
            Title <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file ? file.name : "Friendly display name"}
              className="block mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={!file || uploading}
            className="btn-primary"
          >
            {uploading ? "Indexing…" : "Upload & index"}
          </button>

          {uploadMsg && (
            <p
              className={`text-sm ${
                uploadMsg.startsWith("✓")
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {uploadMsg}
            </p>
          )}
        </form>
      </aside>
    </div>
  );
}
