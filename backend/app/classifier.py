"""Intent classifier.

Decides whether a student question is *routine* (answerable from course
materials via RAG) or *substantive* (needs the instructor). Emits a
confidence score so the routing layer can apply a threshold.
"""
from __future__ import annotations

from . import llm
from .schemas import ClassifierOutput, RetrievedChunk

SYSTEM_PROMPT = """You are the intent classifier for an AI teaching assistant.

Decide whether a student's question is ROUTINE or SUBSTANTIVE.

ROUTINE = factual / logistical, fully answerable from the provided course
materials. Examples: deadlines, formatting rules, where to submit, grade
weights, office hours, syllabus content, FAQ items.

SUBSTANTIVE = requires the instructor's judgment, opinion, or new information
not in the materials. Examples: subjective grading appeals, extension
requests, conceptual help on assignment thinking, anything pastoral, anything
that involves a decision only the instructor can make.

When in doubt, prefer SUBSTANTIVE: false negatives (substantive questions
answered automatically) are higher-stakes than false positives (routine
questions sent to the instructor).

You must respond with ONLY a JSON object, no prose, in this exact shape:
{
  "intent": "routine" | "substantive",
  "confidence": <float between 0 and 1>,
  "reasoning": "<one sentence>"
}
"""


def _format_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "(no course materials retrieved)"
    lines = []
    for i, c in enumerate(chunks, 1):
        lines.append(f"[{i}] source={c.source} doc_type={c.doc_type} score={c.score}")
        lines.append(c.text.strip())
        lines.append("")
    return "\n".join(lines)


def classify(question: str, context: list[RetrievedChunk]) -> ClassifierOutput:
    user = (
        f"COURSE MATERIALS (retrieved by similarity to the question):\n"
        f"{_format_context(context)}\n\n"
        f"STUDENT QUESTION:\n{question}\n\n"
        f"Classify it. Return JSON only."
    )
    raw = llm.complete(system=SYSTEM_PROMPT, user=user, max_tokens=400, temperature=0.0)
    data = llm.extract_json(raw)

    intent = str(data.get("intent", "substantive")).lower()
    if intent not in ("routine", "substantive"):
        intent = "substantive"
    confidence = float(data.get("confidence", 0.5))
    confidence = max(0.0, min(1.0, confidence))
    reasoning = str(data.get("reasoning", "")).strip() or "No reasoning provided."

    return ClassifierOutput(intent=intent, confidence=confidence, reasoning=reasoning)
