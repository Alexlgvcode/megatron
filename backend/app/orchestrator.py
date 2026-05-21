"""AI orchestration layer.

Single entry point used by the chat endpoint. Implements the lifecycle
shown in slide 7 of the architecture deck:

  1. Log the question.
  2. Retrieve top-k chunks from the vector store.
  3. Classify intent + confidence with the LLM.
  4. Apply confidence threshold; route to RAG or escalation.
  5. Persist the answer / escalation record.
"""
from __future__ import annotations

import json
from datetime import datetime

from . import classifier, escalation, generator, vectorstore
from .config import get_settings
from .db import QuestionRecord, session_scope
from .schemas import ChatResponse, RetrievedChunk


def _persist_question(
    *,
    question: str,
    session_id: str | None,
    intent: str,
    confidence: float,
    reasoning: str,
    routed_to: str,
    answer: str | None,
    sources: list[RetrievedChunk],
) -> int:
    with session_scope() as s:
        rec = QuestionRecord(
            session_id=session_id,
            question=question,
            intent=intent,
            confidence=confidence,
            reasoning=reasoning,
            routed_to=routed_to,
            answer=answer,
            sources_json=json.dumps([c.model_dump() for c in sources]),
            created_at=datetime.utcnow(),
        )
        s.add(rec)
        s.commit()
        s.refresh(rec)
        return rec.id


def handle_question(question: str, session_id: str | None = None) -> ChatResponse:
    settings = get_settings()

    # 1. Retrieve context.
    context = vectorstore.query(question, top_k=settings.top_k)

    # 2. Classify.
    decision = classifier.classify(question, context)

    # 3. Apply threshold. Low-confidence routine -> escalate as a safety net.
    routed_to: str
    answer: str | None = None
    escalated = False

    if decision.intent == "routine" and decision.confidence >= settings.confidence_threshold:
        # 4a. Generate grounded answer.
        try:
            answer = generator.generate_answer(question, context)
        except Exception as e:
            # If generation fails, escalate rather than show a broken reply.
            answer = None
            routed_to = "instructor"
            escalated = True
            reasoning = f"{decision.reasoning} | generator_error={e}"
            qid = _persist_question(
                question=question,
                session_id=session_id,
                intent=decision.intent,
                confidence=decision.confidence,
                reasoning=reasoning,
                routed_to=routed_to,
                answer=None,
                sources=context,
            )
            escalation.create_escalation(qid)
            return ChatResponse(
                question_id=qid,
                intent=decision.intent,
                confidence=decision.confidence,
                routed_to=routed_to,
                answer=None,
                sources=context,
                reasoning=reasoning,
                escalated=True,
            )
        routed_to = "student"
    else:
        # 4b. Escalate.
        routed_to = "instructor"
        escalated = True

    # 5. Persist.
    qid = _persist_question(
        question=question,
        session_id=session_id,
        intent=decision.intent,
        confidence=decision.confidence,
        reasoning=decision.reasoning,
        routed_to=routed_to,
        answer=answer,
        sources=context,
    )
    if escalated:
        escalation.create_escalation(qid)

    return ChatResponse(
        question_id=qid,
        intent=decision.intent,
        confidence=decision.confidence,
        routed_to=routed_to,
        answer=answer,
        sources=context,
        reasoning=decision.reasoning,
        escalated=escalated,
    )
