"""RAG response generator.

Used for ROUTINE questions. Grounded strictly in retrieved chunks; if a
chunk doesn't cover something the model is told to say so rather than guess.
"""
from __future__ import annotations

from . import llm
from .schemas import RetrievedChunk


SYSTEM_PROMPT = """You are an AI teaching assistant answering a student's
routine question about a course.

Rules:
- Use ONLY the provided course materials. Do not invent policies, dates, or
  grade weights.
- If the materials do not contain the answer, say so plainly and suggest the
  student message the instructor.
- Be concise (2-5 sentences) and student-friendly.
- After the answer, on its own line, write:  Sources: [1], [2], ...
  referencing the numbered chunks you actually used.
"""


def _format_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "(no course materials retrieved)"
    lines = []
    for i, c in enumerate(chunks, 1):
        lines.append(f"[{i}] {c.source} ({c.doc_type})")
        lines.append(c.text.strip())
        lines.append("")
    return "\n".join(lines)


def generate_answer(question: str, context: list[RetrievedChunk]) -> str:
    user = (
        f"COURSE MATERIALS:\n{_format_context(context)}\n\n"
        f"STUDENT QUESTION:\n{question}\n\n"
        f"Write your answer now."
    )
    return llm.complete(system=SYSTEM_PROMPT, user=user, max_tokens=600, temperature=0.2)
