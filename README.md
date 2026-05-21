# Megatron — AI Teaching Assistant

A full-stack reference implementation of the architecture documented in
`architecture_megatronV2html.html`.

The system sits between students and the instructor:

- Routine questions (deadlines, rubric details, FAQ items) are answered
  instantly via a RAG pipeline grounded in uploaded course materials.
- Substantive questions (judgment calls, extensions, conceptual help) are
  packaged with the AI's reasoning and routed to an instructor dashboard.

## Stack

| Layer            | Choice                                              |
| ---------------- | --------------------------------------------------- |
| Frontend         | Vite + React 18 + Tailwind + React Router           |
| Backend          | FastAPI + SQLAlchemy (SQLite)                       |
| LLM              | Anthropic Claude API                                |
| Vector DB        | ChromaDB (local, persistent)                        |
| Embeddings       | sentence-transformers `all-MiniLM-L6-v2` (local)    |

## Layout

```
megatron/
  backend/
    app/
      main.py            FastAPI app + routes
      orchestrator.py    AI orchestration layer
      classifier.py      Intent classifier (LLM)
      generator.py       RAG response generator
      escalation.py      Escalation queue
      ingestion.py       Chunk + embed + index pipeline
      vectorstore.py     ChromaDB wrapper
      db.py              SQLite (questions, escalations, documents)
      llm.py             Claude API client
      schemas.py         Pydantic models
      config.py          Settings
    requirements.txt
    .env.example
    run.sh
  frontend/
    src/
      pages/
        StudentChat.jsx
        InstructorDashboard.jsx
        AdminUpload.jsx
      components/Layout.jsx, SourcesList.jsx
      lib/api.js, format.js
      App.jsx, main.jsx, index.css
    package.json
    vite.config.js
    tailwind.config.js
```

## Prerequisites

- Python 3.10+
- Node 18+ and npm
- An Anthropic API key

## 1. Backend

```bash
cd backend
cp .env.example .env       # then edit .env and paste your ANTHROPIC_API_KEY
./run.sh                   # creates .venv, installs deps, starts uvicorn on :8000
```

On first run, downloading the sentence-transformers embedding model takes
~80MB. After that everything is local.

Health check: <http://localhost:8000/api/health>

## 2. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`, so the
frontend uses relative URLs in both dev and production.

## 3. First-time setup

1. Open <http://localhost:5173/admin>.
2. Upload your syllabus (`.pdf`, `.txt`, or `.md`), rubrics, and any FAQs.
3. Switch to **Student chat** and start asking questions.
4. Substantive ones appear under **Instructor dashboard**.

A tiny sample syllabus is included at `backend/data/sample-syllabus.md` if
you want to test before uploading real materials.

## Tuning knobs

All in `backend/.env`:

| Variable                 | Default       | Effect                                                        |
| ------------------------ | ------------- | ------------------------------------------------------------- |
| `ANTHROPIC_MODEL`        | claude-sonnet-4-6 | Used for classification + generation                      |
| `CONFIDENCE_THRESHOLD`   | 0.65          | Routine answers below this score get escalated as a safety net |
| `TOP_K`                  | 5             | Retrieved chunks per query                                    |

## Evaluation hooks

Slide 9 of the deck describes the eval plan. The pieces it depends on are
already wired:

- Every question is logged with intent, confidence, and routing decision
  (`GET /api/questions`).
- Every escalation persists with sources + classifier reasoning, so an
  instructor can post-hoc label and compute precision/recall by class.
- The question log doubles as ground-truth data for that labeling pass.

## API surface

```
GET    /api/health                       service + index stats
POST   /api/chat                         { question, session_id } -> chat reply
GET    /api/documents                    list indexed documents
POST   /api/documents                    multipart upload
DELETE /api/documents/{id}               remove a document
GET    /api/escalations[?status=…]       instructor queue
POST   /api/escalations/{id}/answer      { answer }
GET    /api/questions?limit=100          full question log
GET    /api/retrieve?q=…&k=…             retrieval probe (debug)
```

## Architecture mapping

| Deck slide                | Code                                       |
| ------------------------- | ------------------------------------------ |
| Document ingestion        | `app/ingestion.py`, `app/vectorstore.py`   |
| Intent Classifier         | `app/classifier.py`                        |
| Response Generator (RAG)  | `app/generator.py`                         |
| Escalation Engine         | `app/escalation.py`                        |
| Instructor Dashboard      | `frontend/src/pages/InstructorDashboard.jsx` |
| Chat Interface            | `frontend/src/pages/StudentChat.jsx`       |
| Orchestration             | `app/orchestrator.py`                      |
