"""Escalation engine.

Wraps a question + the AI's reasoning + retrieved context into a structured
record that surfaces on the instructor dashboard. Nothing is silently
dropped: every escalation is persistent and reviewable.
"""
from __future__ import annotations

import json
from datetime import datetime

from .db import EscalationRecord, QuestionRecord, session_scope
from .schemas import EscalationListItem, RetrievedChunk


def create_escalation(question_id: int) -> int:
    with session_scope() as s:
        rec = EscalationRecord(question_id=question_id, status="pending", created_at=datetime.utcnow())
        s.add(rec)
        s.commit()
        s.refresh(rec)
        return rec.id


def list_escalations(status: str | None = None) -> list[EscalationListItem]:
    with session_scope() as s:
        q = s.query(EscalationRecord, QuestionRecord).join(
            QuestionRecord, EscalationRecord.question_id == QuestionRecord.id
        )
        if status:
            q = q.filter(EscalationRecord.status == status)
        rows = q.order_by(EscalationRecord.created_at.desc()).all()

        out: list[EscalationListItem] = []
        for esc, qrec in rows:
            sources_raw = qrec.sources_json
            sources: list[RetrievedChunk] = []
            if sources_raw:
                try:
                    sources = [RetrievedChunk(**c) for c in json.loads(sources_raw)]
                except Exception:
                    sources = []
            out.append(
                EscalationListItem(
                    id=esc.id,
                    question_id=qrec.id,
                    question=qrec.question,
                    intent=qrec.intent,
                    confidence=qrec.confidence,
                    reasoning=qrec.reasoning,
                    status=esc.status,
                    created_at=esc.created_at,
                    answered_at=esc.answered_at,
                    instructor_answer=esc.instructor_answer,
                    sources=sources,
                )
            )
        return out


def delete_escalation(escalation_id: int) -> bool:
    with session_scope() as s:
        esc = s.query(EscalationRecord).filter(EscalationRecord.id == escalation_id).one_or_none()
        if esc is None:
            return False
        question_id = esc.question_id
        s.delete(esc)
        qrec = s.query(QuestionRecord).filter(QuestionRecord.id == question_id).one_or_none()
        if qrec:
            s.delete(qrec)
        s.commit()
        return True


def answer_escalation(escalation_id: int, answer: str) -> EscalationListItem | None:
    with session_scope() as s:
        esc = s.query(EscalationRecord).filter(EscalationRecord.id == escalation_id).one_or_none()
        if esc is None:
            return None
        esc.status = "answered"
        esc.instructor_answer = answer
        esc.answered_at = datetime.utcnow()
        s.commit()
    # Re-read so the listing helper hydrates the question payload uniformly.
    items = [e for e in list_escalations() if e.id == escalation_id]
    return items[0] if items else None
