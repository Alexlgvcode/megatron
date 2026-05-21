"""Document ingestion pipeline.

Steps:
  1. Read raw text from the uploaded file (.txt, .md, .pdf).
  2. Chunk into overlapping windows so embedding context is preserved.
  3. Push chunks into the vector store with metadata.
  4. Record the document row in SQLite so the admin UI can list / delete it.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from pathlib import Path

from . import vectorstore
from .config import get_settings
from .db import DocumentRecord, session_scope
from .schemas import DocumentInfo


CHUNK_TARGET_CHARS = 900
CHUNK_OVERLAP_CHARS = 150


# ---------- file -> text ----------

def _read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader  # local import keeps cold start lean
        reader = PdfReader(str(path))
        return "\n\n".join((p.extract_text() or "") for p in reader.pages)
    # .txt, .md, anything textual
    return path.read_text(encoding="utf-8", errors="ignore")


# ---------- chunking ----------

_PARA_SPLIT = re.compile(r"\n\s*\n")


def chunk_text(text: str) -> list[str]:
    """Paragraph-aware sliding window. Small but effective for course materials."""
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []

    # Pack paragraphs greedily up to CHUNK_TARGET_CHARS, then start a new chunk
    # carrying CHUNK_OVERLAP_CHARS of the tail.
    paragraphs = [p.strip() for p in _PARA_SPLIT.split(text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paragraphs:
        if not buf:
            buf = p
            continue
        if len(buf) + 1 + len(p) <= CHUNK_TARGET_CHARS:
            buf = f"{buf}\n\n{p}"
        else:
            chunks.append(buf)
            tail = buf[-CHUNK_OVERLAP_CHARS:] if CHUNK_OVERLAP_CHARS else ""
            buf = f"{tail}\n\n{p}" if tail else p
    if buf:
        chunks.append(buf)

    # Long paragraphs may still exceed the target; hard-split as a safety net.
    out: list[str] = []
    for c in chunks:
        if len(c) <= CHUNK_TARGET_CHARS * 1.5:
            out.append(c)
        else:
            for i in range(0, len(c), CHUNK_TARGET_CHARS):
                out.append(c[i : i + CHUNK_TARGET_CHARS])
    return out


# ---------- public api ----------

def ingest_file(*, filename: str, raw_bytes: bytes, doc_type: str, title: str | None = None) -> DocumentInfo:
    settings = get_settings()
    doc_id = uuid.uuid4().hex
    safe_name = filename.replace("/", "_").replace("\\", "_")
    target = settings.upload_path / f"{doc_id}__{safe_name}"
    target.write_bytes(raw_bytes)

    text = _read_text(target)
    chunks = chunk_text(text)
    vectorstore.add_chunks(
        doc_id=doc_id,
        filename=safe_name,
        doc_type=doc_type,
        chunks=chunks,
    )

    with session_scope() as s:
        rec = DocumentRecord(
            id=doc_id,
            filename=safe_name,
            title=title or safe_name,
            doc_type=doc_type,
            chunk_count=len(chunks),
            uploaded_at=datetime.utcnow(),
        )
        s.add(rec)
        s.commit()
        s.refresh(rec)
        return DocumentInfo(
            id=rec.id,
            filename=rec.filename,
            title=rec.title,
            doc_type=rec.doc_type,
            chunk_count=rec.chunk_count,
            uploaded_at=rec.uploaded_at,
        )


def list_documents() -> list[DocumentInfo]:
    with session_scope() as s:
        rows = s.query(DocumentRecord).order_by(DocumentRecord.uploaded_at.desc()).all()
        return [
            DocumentInfo(
                id=r.id,
                filename=r.filename,
                title=r.title,
                doc_type=r.doc_type,
                chunk_count=r.chunk_count,
                uploaded_at=r.uploaded_at,
            )
            for r in rows
        ]


def delete_document(doc_id: str) -> bool:
    vectorstore.delete_document(doc_id)
    with session_scope() as s:
        rec = s.query(DocumentRecord).filter(DocumentRecord.id == doc_id).one_or_none()
        if rec is None:
            return False
        s.delete(rec)
        s.commit()
    return True
