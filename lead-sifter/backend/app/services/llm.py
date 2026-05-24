from __future__ import annotations

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from ..config import get_settings

Provider = Literal["openai", "anthropic"]

# Hardcoded Anthropic models per spec; live API list is preferred when reachable.
ANTHROPIC_FALLBACK_MODELS = [
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
]


@dataclass
class Message:
    role: Literal["system", "user", "assistant"]
    content: str


async def list_models(provider: Provider, api_key: str) -> list[str]:
    settings = get_settings()
    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        try:
            models = await client.models.list()
            pattern = re.compile(settings.openai_model_filter)
            names = sorted({m.id for m in models.data if pattern.search(m.id)})
            return names
        finally:
            await client.close()
    # anthropic
    try:
        async with httpx.AsyncClient(timeout=10.0) as h:
            r = await h.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
            )
            if r.status_code == 200:
                data = r.json().get("data", [])
                live = sorted({m["id"] for m in data})
                if live:
                    return live
    except Exception:
        pass
    return list(ANTHROPIC_FALLBACK_MODELS)


async def test_key(provider: Provider, api_key: str) -> tuple[bool, str]:
    try:
        if provider == "openai":
            client = AsyncOpenAI(api_key=api_key)
            try:
                await client.models.list()
                return True, "ok"
            finally:
                await client.close()
        client_a = AsyncAnthropic(api_key=api_key)
        try:
            # 1-token completion to verify key works
            await client_a.messages.create(
                model="claude-haiku-4-5",
                max_tokens=1,
                messages=[{"role": "user", "content": "ok"}],
            )
            return True, "ok"
        finally:
            await client_a.close()
    except Exception as e:
        return False, str(e)


async def stream_chat(
    provider: Provider,
    api_key: str,
    model: str,
    messages: list[Message],
    json_mode: bool = False,
) -> AsyncIterator[str]:
    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": [m.__dict__ for m in messages],
                "stream": True,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            stream = await client.chat.completions.create(**kwargs)
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        finally:
            await client.close()
        return

    # anthropic
    system = "\n\n".join(m.content for m in messages if m.role == "system") or None
    rest = [
        {"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")
    ]
    client_a = AsyncAnthropic(api_key=api_key)
    try:
        kwargs2: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": rest,
        }
        if system:
            kwargs2["system"] = system
        async with client_a.messages.stream(**kwargs2) as stream:
            async for text in stream.text_stream:
                yield text
    finally:
        await client_a.close()


async def complete_json(
    provider: Provider,
    api_key: str,
    model: str,
    system: str,
    user: str,
    schema: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any] | None]:
    """One-shot non-streamed completion that returns raw text. Caller parses JSON."""
    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
            )
            text = resp.choices[0].message.content or ""
            return text, None
        finally:
            await client.close()

    client_a = AsyncAnthropic(api_key=api_key)
    try:
        resp = await client_a.messages.create(
            model=model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # Anthropic returns content blocks; concatenate text blocks.
        parts = []
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                parts.append(block.text)
        return "".join(parts), None
    finally:
        await client_a.close()
