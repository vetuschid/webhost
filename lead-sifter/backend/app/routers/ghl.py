from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crypto
from ..db import get_session
from ..models import ApiKey, Lead, LeadResult
from ..schemas import GhlPushSelection, GhlTarget, ToolMapOut
from ..services import ghl_mcp
from ..services.sifter import _lead_to_ghl_contact

router = APIRouter(prefix="/ghl", tags=["ghl"])


async def _creds(s: AsyncSession) -> tuple[str, str]:
    pit = (
        await s.execute(select(ApiKey).where(ApiKey.provider == "ghl_pit"))
    ).scalar_one_or_none()
    loc = (
        await s.execute(select(ApiKey).where(ApiKey.provider == "ghl_location_id"))
    ).scalar_one_or_none()
    if not pit or not loc:
        raise HTTPException(400, "GHL PIT and locationId must be set")
    return crypto.decrypt(pit.ciphertext), crypto.decrypt(loc.ciphertext)


@router.get("/tool-map", response_model=ToolMapOut)
async def tool_map(
    refresh: bool = False, session: AsyncSession = Depends(get_session)
) -> ToolMapOut:
    pit, loc = await _creds(session)
    cache = await ghl_mcp.discover(pit, loc, force=refresh)
    return ToolMapOut(
        upsert_contact=cache.mapping.get("upsert_contact"),
        create_opportunity=cache.mapping.get("create_opportunity"),
        add_tags=cache.mapping.get("add_tags"),
        add_to_workflow=cache.mapping.get("add_to_workflow"),
        raw_tools=[t["name"] for t in cache.tools],
    )


@router.get("/pipelines")
async def pipelines(session: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    pit, loc = await _creds(session)
    return await ghl_mcp.list_pipelines(pit, loc)


@router.get("/tags")
async def tags(session: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    pit, loc = await _creds(session)
    return await ghl_mcp.list_tags(pit, loc)


@router.get("/workflows")
async def workflows(session: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    pit, loc = await _creds(session)
    return await ghl_mcp.list_workflows(pit, loc)


@router.post("/push")
async def push_selection(
    body: GhlPushSelection,
    target: GhlTarget,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    pit, loc = await _creds(session)
    summaries: list[dict[str, Any]] = []
    for lrid in body.lead_result_ids:
        lr = (
            await session.execute(select(LeadResult).where(LeadResult.id == lrid))
        ).scalar_one_or_none()
        if not lr:
            summaries.append({"lead_result_id": lrid, "error": "not found"})
            continue
        lead = (
            await session.execute(select(Lead).where(Lead.id == lr.lead_id))
        ).scalar_one_or_none()
        if not lead:
            summaries.append({"lead_result_id": lrid, "error": "lead missing"})
            continue
        try:
            res = await ghl_mcp.upsert_contact_and_followups(
                pit,
                loc,
                _lead_to_ghl_contact(lead, lr.output),
                target.pipeline_id,
                target.stage_id,
                target.tags,
                target.workflow_id,
            )
            lr.pushed_to_ghl = "error" not in res
            lr.ghl_result = res
            summaries.append({"lead_result_id": lrid, "result": res})
        except Exception as e:
            summaries.append({"lead_result_id": lrid, "error": str(e)})
    return {"results": summaries}
