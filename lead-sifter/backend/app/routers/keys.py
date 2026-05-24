from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crypto
from ..db import get_session
from ..models import PROVIDERS, ApiKey
from ..schemas import ApiKeyIn, ApiKeyOut, TestResult
from ..services import apollo, ghl_mcp, llm

router = APIRouter(prefix="/keys", tags=["keys"])


async def _get_value(session: AsyncSession, provider: str) -> str | None:
    row = (
        await session.execute(select(ApiKey).where(ApiKey.provider == provider))
    ).scalar_one_or_none()
    if not row:
        return None
    return crypto.decrypt(row.ciphertext)


@router.get("", response_model=list[ApiKeyOut])
async def list_keys(session: AsyncSession = Depends(get_session)) -> list[ApiKey]:
    rows = (await session.execute(select(ApiKey).order_by(ApiKey.provider))).scalars().all()
    return list(rows)


@router.put("", response_model=ApiKeyOut)
async def upsert_key(
    body: ApiKeyIn, session: AsyncSession = Depends(get_session)
) -> ApiKey:
    if body.provider not in PROVIDERS:
        raise HTTPException(400, f"unknown provider {body.provider}")
    value = body.value.strip()
    if not value:
        raise HTTPException(400, "empty value")
    existing = (
        await session.execute(select(ApiKey).where(ApiKey.provider == body.provider))
    ).scalar_one_or_none()
    if existing:
        existing.ciphertext = crypto.encrypt(value)
        existing.last4 = crypto.last4(value)
        await session.flush()
        return existing
    row = ApiKey(provider=body.provider, ciphertext=crypto.encrypt(value), last4=crypto.last4(value))
    session.add(row)
    await session.flush()
    return row


@router.delete("/{provider}")
async def delete_key(provider: str, session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    row = (
        await session.execute(select(ApiKey).where(ApiKey.provider == provider))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "not found")
    await session.delete(row)
    return {"status": "deleted"}


@router.post("/{provider}/test", response_model=TestResult)
async def test_provider(
    provider: str, session: AsyncSession = Depends(get_session)
) -> TestResult:
    if provider == "ghl_pit":
        pit = await _get_value(session, "ghl_pit")
        loc = await _get_value(session, "ghl_location_id")
        if not pit or not loc:
            return TestResult(ok=False, detail="missing ghl_pit or ghl_location_id")
        ok, msg = await ghl_mcp.test_connection(pit, loc)
        return TestResult(ok=ok, detail=msg)
    if provider == "ghl_location_id":
        return await test_provider("ghl_pit", session)
    if provider == "apollo":
        v = await _get_value(session, "apollo")
        if not v:
            return TestResult(ok=False, detail="not set")
        ok, msg = await apollo.test_key(v)
        return TestResult(ok=ok, detail=msg)
    if provider in ("openai", "anthropic"):
        v = await _get_value(session, provider)
        if not v:
            return TestResult(ok=False, detail="not set")
        ok, msg = await llm.test_key(provider, v)
        return TestResult(ok=ok, detail=msg)
    raise HTTPException(400, f"unknown provider {provider}")


@router.get("/models/{provider}")
async def list_provider_models(
    provider: str, session: AsyncSession = Depends(get_session)
) -> dict[str, list[str]]:
    if provider not in ("openai", "anthropic"):
        raise HTTPException(400, "provider must be openai or anthropic")
    v = await _get_value(session, provider)
    if not v:
        return {"models": []}
    models = await llm.list_models(provider, v)
    return {"models": models}
