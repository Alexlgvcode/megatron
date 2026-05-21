"""ChromaDB-backed vector store.

Embeddings use Chroma's default sentence-transformers model (all-MiniLM-L6-v2)
so no API key is required for retrieval.
"""
from __future__ import annotations

from typing import Iterable

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from .config import get_settings
from .schemas import RetrievedChunk


_COLLECTION = "course_materials"
_client = None
_collection = None


def _ensure_client():
    global _client, _collection
    if _collection is not None:
        return _collection

    settings = get_settings()
    _client = chromadb.PersistentClient(
        path=str(settings.chroma_path),
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    _collection = _client.get_or_create_collection(
        name=_COLLECTION,
        embedding_function=embed_fn,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def add_chunks(
    *,
    doc_id: str,
    filename: str,
    doc_type: str,
    chunks: list[str],
) -> int:
    """Insert chunks for a document. Returns number of chunks added."""
    if not chunks:
        return 0
    col = _ensure_client()
    ids = [f"{doc_id}:{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "doc_type": doc_type,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]
    col.add(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def delete_document(doc_id: str) -> None:
    col = _ensure_client()
    col.delete(where={"doc_id": doc_id})


def query(question: str, top_k: int) -> list[RetrievedChunk]:
    col = _ensure_client()
    if col.count() == 0:
        return []
    res = col.query(
        query_texts=[question],
        n_results=min(top_k, col.count()),
        include=["documents", "metadatas", "distances"],
    )
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    out: list[RetrievedChunk] = []
    for text, meta, dist in zip(docs, metas, dists):
        # cosine distance in [0, 2]; convert to similarity in [0, 1].
        sim = max(0.0, 1.0 - float(dist))
        out.append(
            RetrievedChunk(
                text=text,
                source=meta.get("filename", "unknown"),
                doc_type=meta.get("doc_type", "other"),
                chunk_index=int(meta.get("chunk_index", 0)),
                score=round(sim, 4),
            )
        )
    return out


def collection_stats() -> dict:
    col = _ensure_client()
    return {"chunks": col.count()}
