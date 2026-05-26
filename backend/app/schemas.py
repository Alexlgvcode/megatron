"""Pydantic schemas shared by routes."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------- Documents / ingestion ----------

class DocumentInfo(BaseModel):
    id: str
    filename: str
    title: str
    doc_type: str  # syllabus | rubric | assignment | faq | other
    chunk_count: int
    storage_url: Optional[str] = None
    uploaded_at: datetime


class IngestResponse(BaseModel):
    document: DocumentInfo
    message: str


# ---------- Retrieval ----------

class RetrievedChunk(BaseModel):
    text: str
    source: str          # filename
    doc_type: str
    chunk_index: int
    score: float         # similarity (higher = more relevant)


# ---------- Chat / classification ----------

Intent = Literal["routine", "substantive"]


class ClassifierOutput(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    question_id: int
    escalation_id: Optional[int] = None
    intent: Intent
    confidence: float
    routed_to: Literal["student", "instructor"]
    answer: Optional[str] = None
    sources: list[RetrievedChunk] = []
    reasoning: str
    escalated: bool


# ---------- Escalation queue ----------

class EscalationListItem(BaseModel):
    id: int
    question_id: int
    question: str
    intent: Intent
    confidence: float
    reasoning: str
    status: Literal["pending", "answered"]
    created_at: datetime
    answered_at: Optional[datetime] = None
    instructor_answer: Optional[str] = None
    sources: list[RetrievedChunk] = []


class InstructorAnswerRequest(BaseModel):
    answer: str


# ---------- Question log ----------

class QuestionLogItem(BaseModel):
    id: int
    question: str
    intent: Intent
    confidence: float
    routed_to: Literal["student", "instructor"]
    answer: Optional[str]
    reasoning: str
    created_at: datetime
    session_id: Optional[str]


# ---------- Feedback ----------

class FeedbackRequest(BaseModel):
    question_id: int
    rating: Literal["thumbs_up", "neutral", "thumbs_down"]
    comment: Optional[str] = None
    session_id: Optional[str] = None


class FeedbackItem(BaseModel):
    id: int
    question_id: int
    question: str
    answer: Optional[str]
    rating: Literal["thumbs_up", "neutral", "thumbs_down"]
    comment: Optional[str]
    session_id: Optional[str]
    created_at: datetime


class EscalationFeedbackRequest(BaseModel):
    rating: Literal["thumbs_up", "neutral", "thumbs_down"]
    comment: Optional[str] = None


class EscalationFeedbackItem(BaseModel):
    id: int
    escalation_id: int
    question_id: int
    rating: Literal["thumbs_up", "neutral", "thumbs_down"]
    comment: Optional[str]
    created_at: datetime
