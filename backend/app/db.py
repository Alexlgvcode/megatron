"""PostgreSQL-backed storage for the question log and escalation queue.

Uses Supabase's managed PostgreSQL via SQLAlchemy.
The vector store lives in ChromaDB (see vectorstore.py).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    title = Column(String, nullable=False)
    doc_type = Column(String, nullable=False)
    chunk_count = Column(Integer, nullable=False, default=0)
    storage_url = Column(String, nullable=True)       # public URL in Supabase Storage
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class QuestionRecord(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=True)
    question = Column(Text, nullable=False)
    intent = Column(String, nullable=False)           # routine | substantive
    confidence = Column(Float, nullable=False)
    routed_to = Column(String, nullable=False)        # student | instructor
    answer = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=False, default="")
    sources_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class EscalationRecord(Base):
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")   # pending | answered
    instructor_answer = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)


class FeedbackRecord(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    rating = Column(String, nullable=False)   # thumbs_up | neutral | thumbs_down
    comment = Column(Text, nullable=True)
    session_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


_engine = None
_SessionLocal = None


def init_db():
    """Create tables; safe to call multiple times."""
    global _engine, _SessionLocal
    settings = get_settings()
    _engine = create_engine(settings.database_url, future=True)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(_engine)


def session_scope():
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()
