"""Thin wrapper around the Anthropic Claude API.

The classifier and generator both call into this module. Keeping a single
entry point makes it easy to swap models, add retries, or stub for testing.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from anthropic import Anthropic

from .config import get_settings


_client: Optional[Anthropic] = None


def _client_singleton() -> Anthropic:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Copy backend/.env.example to backend/.env "
                "and add your key."
            )
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def complete(
    *,
    system: str,
    user: str,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> str:
    """Return the assistant text for a single-shot prompt."""
    settings = get_settings()
    msg = _client_singleton().messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    # Concatenate any text blocks Claude returned.
    parts = []
    for block in msg.content:
        # Anthropic SDK objects expose .type and .text for text blocks.
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def extract_json(text: str) -> dict:
    """Pull a JSON object out of an LLM reply, tolerating code fences / chatter."""
    m = _JSON_FENCE.search(text)
    if m:
        return json.loads(m.group(1))
    # Fall back: first { ... } substring
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError(f"Could not extract JSON from model output: {text!r}")
