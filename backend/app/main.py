"""FastAPI entry point. Wires every route to its service module."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import escalation, ingestion, orchestrator, vectorstore
from .config import get_settings
from .db import FeedbackRecord, QuestionRecord, init_db, session_scope
from .schemas import (
    ChatRequest,
    ChatResponse,
    DocumentInfo,
    EscalationListItem,
    FeedbackItem,
    FeedbackRequest,
    IngestResponse,
    InstructorAnswerRequest,
    QuestionLogItem,
    RetrievedChunk,
)


settings = get_settings()
app = FastAPI(title="Megatron — AI Teaching Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---------- Health ----------

@app.get("/api/health")
def health() -> dict:
    stats = vectorstore.collection_stats()
    return {
        "status": "ok",
        "model": settings.anthropic_model,
        "confidence_threshold": settings.confidence_threshold,
        "top_k": settings.top_k,
        "indexed_chunks": stats["chunks"],
        "anthropic_configured": bool(settings.anthropic_api_key),
    }


# ---------- Chat (student) ----------

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must be non-empty")
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="Anthropic API key not configured. Set ANTHROPIC_API_KEY in backend/.env.",
        )
    return orchestrator.handle_question(req.question, session_id=req.session_id)


# ---------- Documents (instructor admin) ----------

@app.get("/api/documents", response_model=list[DocumentInfo])
def list_documents() -> list[DocumentInfo]:
    return ingestion.list_documents()


@app.post("/api/documents", response_model=IngestResponse)
async def upload_document(
    file: UploadFile = File(...),
    doc_type: Literal["syllabus", "rubric", "assignment", "faq", "other"] = Form("other"),
    title: str | None = Form(None),
) -> IngestResponse:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")
    info = ingestion.ingest_file(
        filename=file.filename or "uploaded",
        raw_bytes=raw,
        doc_type=doc_type,
        title=title,
    )
    return IngestResponse(document=info, message=f"Indexed {info.chunk_count} chunks")


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str) -> dict:
    ok = ingestion.delete_document(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="document not found")
    return {"deleted": doc_id}


# ---------- Escalations (instructor dashboard) ----------

@app.get("/api/escalations", response_model=list[EscalationListItem])
def list_escalations(status: Literal["pending", "answered"] | None = None) -> list[EscalationListItem]:
    return escalation.list_escalations(status=status)


@app.get("/api/escalations/{escalation_id}", response_model=EscalationListItem)
def get_escalation(escalation_id: int) -> EscalationListItem:
    items = [e for e in escalation.list_escalations() if e.id == escalation_id]
    if not items:
        raise HTTPException(status_code=404, detail="escalation not found")
    return items[0]


@app.delete("/api/escalations/{escalation_id}")
def delete_escalation(escalation_id: int) -> dict:
    ok = escalation.delete_escalation(escalation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="escalation not found")
    return {"deleted": escalation_id}


@app.post("/api/escalations/{escalation_id}/answer", response_model=EscalationListItem)
def answer_escalation(escalation_id: int, body: InstructorAnswerRequest) -> EscalationListItem:
    item = escalation.answer_escalation(escalation_id, body.answer)
    if item is None:
        raise HTTPException(status_code=404, detail="escalation not found")
    return item


# ---------- Question log (eval / debug) ----------

@app.get("/api/questions", response_model=list[QuestionLogItem])
def list_questions(limit: int = 100) -> list[QuestionLogItem]:
    with session_scope() as s:
        rows = (
            s.query(QuestionRecord)
            .order_by(QuestionRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            QuestionLogItem(
                id=r.id,
                question=r.question,
                intent=r.intent,
                confidence=r.confidence,
                routed_to=r.routed_to,
                answer=r.answer,
                reasoning=r.reasoning,
                created_at=r.created_at,
                session_id=r.session_id,
            )
            for r in rows
        ]


# ---------- Retrieval probe (dev / debug) ----------

@app.get("/api/retrieve", response_model=list[RetrievedChunk])
def retrieve(q: str, k: int | None = None) -> list[RetrievedChunk]:
    return vectorstore.query(q, top_k=k or settings.top_k)


# ---------- Feedback ----------

@app.post("/api/feedback", response_model=FeedbackItem)
def submit_feedback(body: FeedbackRequest) -> FeedbackItem:
    with session_scope() as s:
        qrec = s.query(QuestionRecord).filter(QuestionRecord.id == body.question_id).one_or_none()
        if qrec is None:
            raise HTTPException(status_code=404, detail="question not found")
        rec = FeedbackRecord(
            question_id=body.question_id,
            rating=body.rating,
            comment=body.comment or None,
            session_id=body.session_id,
        )
        s.add(rec)
        s.commit()
        s.refresh(rec)
        return FeedbackItem(
            id=rec.id,
            question_id=rec.question_id,
            question=qrec.question,
            answer=qrec.answer,
            rating=rec.rating,
            comment=rec.comment,
            session_id=rec.session_id,
            created_at=rec.created_at,
        )


@app.get("/api/feedback", response_model=list[FeedbackItem])
def list_feedback() -> list[FeedbackItem]:
    with session_scope() as s:
        rows = (
            s.query(FeedbackRecord, QuestionRecord)
            .join(QuestionRecord, FeedbackRecord.question_id == QuestionRecord.id)
            .order_by(FeedbackRecord.created_at.desc())
            .all()
        )
        return [
            FeedbackItem(
                id=fb.id,
                question_id=qrec.id,
                question=qrec.question,
                answer=qrec.answer,
                rating=fb.rating,
                comment=fb.comment,
                session_id=fb.session_id,
                created_at=fb.created_at,
            )
            for fb, qrec in rows
        ]
