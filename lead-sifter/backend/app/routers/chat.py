from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crypto
from ..db import get_session, session_scope
from ..models import ApiKey, ChatMessage, ChatSession, ContextBundle
from ..schemas import ChatMessageOut, ChatSendIn, ChatSessionOut, ChatStartIn
from ..services import llm
from ..services.llm import Message
from ..sse import sse_response

router = APIRouter(prefix="/chat", tags=["chat"])


async def _key(s: AsyncSession, provider: str) -> str | None:
    row = (
        await s.execute(select(ApiKey).where(ApiKey.provider == provider))
    ).scalar_one_or_none()
    return crypto.decrypt(row.ciphertext) if row else None


@router.post("/sessions", response_model=ChatSessionOut)
async def create_session(
    body: ChatStartIn, session: AsyncSession = Depends(get_session)
) -> ChatSession:
    row = ChatSession(
        title=body.title or "New chat",
        model=body.model,
        provider=body.provider,
        bundle_id=body.bundle_id,
    )
    session.add(row)
    await session.flush()
    return row


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(session: AsyncSession = Depends(get_session)) -> list[ChatSession]:
    rows = (
        (
            await session.execute(
                select(ChatSession).order_by(ChatSession.created_at.desc()).limit(50)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


@router.get("/sessions/{sid}/messages", response_model=list[ChatMessageOut])
async def list_messages(sid: int, session: AsyncSession = Depends(get_session)) -> list[ChatMessage]:
    rows = (
        (
            await session.execute(
                select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.id)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def _load_context(session: AsyncSession, bundle_id: int | None) -> list[Message]:
    if not bundle_id:
        return []
    row = (
        await session.execute(select(ContextBundle).where(ContextBundle.id == bundle_id))
    ).scalar_one_or_none()
    return [Message(role="system", content=row.content)] if row else []


@router.post("/sessions/{sid}/send")
async def send_message(sid: int, body: ChatSendIn):
    async with session_scope() as s:
        sess = (
            await s.execute(select(ChatSession).where(ChatSession.id == sid))
        ).scalar_one_or_none()
        if not sess:
            raise HTTPException(404, "session not found")
        api_key = await _key(s, sess.provider)
        if not api_key:
            raise HTTPException(400, f"{sess.provider} key not set")
        sys_msgs = await _load_context(s, sess.bundle_id)
        prior = (
            (
                await s.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == sid)
                    .order_by(ChatMessage.id)
                )
            )
            .scalars()
            .all()
        )
        history = [Message(role=m.role, content=m.content) for m in prior]  # type: ignore[arg-type]
        s.add(ChatMessage(session_id=sid, role="user", content=body.content))
        await s.flush()
        provider = sess.provider
        model = sess.model

    messages = sys_msgs + history + [Message(role="user", content=body.content)]

    if not body.streaming:
        text, _ = await llm.complete_json(
            provider, api_key, model, sys_msgs[0].content if sys_msgs else "", body.content
        )
        async with session_scope() as s2:
            s2.add(ChatMessage(session_id=sid, role="assistant", content=text))
        return {"content": text}

    async def gen():
        chunks: list[str] = []
        async for piece in llm.stream_chat(provider, api_key, model, messages):
            chunks.append(piece)
            yield {"event": "delta", "content": piece}
        full = "".join(chunks)
        async with session_scope() as s3:
            s3.add(ChatMessage(session_id=sid, role="assistant", content=full))
        yield {"event": "done", "content": full}

    return sse_response(gen())
