from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crypto
from ..db import get_session, session_scope
from ..models import ApiKey, ContextBundle, Lead, LeadResult, Run
from ..schemas import ApolloFilters, GhlTarget, LeadResultOut, RunOut, RunStart
from ..services import apollo, sifter
from ..sse import sse_response

router = APIRouter(prefix="/runs", tags=["runs"])

CANONICAL_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "title",
    "company",
    "domain",
    "linkedin_url",
    "city",
    "state",
    "country",
}


async def _get(s: AsyncSession, provider: str) -> str | None:
    row = (
        await s.execute(select(ApiKey).where(ApiKey.provider == provider))
    ).scalar_one_or_none()
    return crypto.decrypt(row.ciphertext) if row else None


@router.get("", response_model=list[RunOut])
async def list_runs(session: AsyncSession = Depends(get_session)) -> list[Run]:
    rows = (
        (await session.execute(select(Run).order_by(Run.created_at.desc()).limit(100)))
        .scalars()
        .all()
    )
    return list(rows)


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: int, session: AsyncSession = Depends(get_session)) -> Run:
    row = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "not found")
    return row


@router.get("/{run_id}/results", response_model=list[LeadResultOut])
async def get_results(
    run_id: int, session: AsyncSession = Depends(get_session)
) -> list[LeadResult]:
    rows = (
        (
            await session.execute(
                select(LeadResult).where(LeadResult.run_id == run_id).order_by(LeadResult.id)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def _create_run_with_apollo_leads(
    session: AsyncSession, body: RunStart, apollo_key: str
) -> Run:
    bundle = (
        await session.execute(select(ContextBundle).where(ContextBundle.id == body.bundle_id))
    ).scalar_one_or_none()
    if not bundle:
        raise HTTPException(400, "bundle not found")
    if not body.apollo:
        raise HTTPException(400, "apollo filters required when source=apollo")

    people = await apollo.search_people(
        apollo_key,
        person_titles=body.apollo.person_titles or None,
        person_locations=body.apollo.person_locations or None,
        organization_locations=body.apollo.organization_locations or None,
        organization_num_employees_ranges=body.apollo.organization_num_employees_ranges or None,
        q_keywords=body.apollo.q_keywords,
        per_page=body.apollo.per_page,
        max_pages=body.apollo.max_pages,
    )

    if body.apollo.enrich_emails and people:
        details = [
            {
                "first_name": p.get("first_name"),
                "last_name": p.get("last_name"),
                "organization_name": (p.get("organization") or {}).get("name"),
                "domain": (p.get("organization") or {}).get("primary_domain"),
                "linkedin_url": p.get("linkedin_url"),
            }
            for p in people
        ]
        try:
            enriched = await apollo.bulk_match(apollo_key, details)
            for p, e in zip(people, enriched):
                if e and not p.get("email"):
                    p["email"] = e.get("email")
                    if e.get("phone_numbers"):
                        p["phone_numbers"] = e["phone_numbers"]
        except apollo.ApolloError as ex:
            raise HTTPException(502, f"Apollo enrichment failed: {ex}") from ex

    run = Run(
        model=body.model,
        provider=body.provider,
        bundle_id=body.bundle_id,
        source="apollo",
        max_parallel=body.max_parallel,
        streaming=body.streaming,
        ghl_target=body.ghl_target.model_dump(),
        status="pending",
    )
    session.add(run)
    await session.flush()
    for p in people:
        canon = apollo.to_canonical(p)
        session.add(Lead(run_id=run.id, source="apollo", **canon))
    await session.flush()
    return run


@router.post("", response_model=RunOut)
async def create_run(
    body: RunStart, session: AsyncSession = Depends(get_session)
) -> Run:
    if body.source == "apollo":
        key = await _get(session, "apollo")
        if not key:
            raise HTTPException(400, "Apollo key not set")
        return await _create_run_with_apollo_leads(session, body, key)

    raise HTTPException(400, "for CSV source use POST /runs/csv")


@router.post("/csv", response_model=RunOut)
async def create_run_from_csv(
    model: str = Form(...),
    provider: str = Form(...),
    bundle_id: int = Form(...),
    max_parallel: int = Form(default=5),
    streaming: bool = Form(default=True),
    mapping_json: str = Form(...),
    ghl_target_json: str = Form(default="{}"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> Run:
    import json

    if provider not in ("openai", "anthropic"):
        raise HTTPException(400, "provider must be openai|anthropic")
    bundle = (
        await session.execute(select(ContextBundle).where(ContextBundle.id == bundle_id))
    ).scalar_one_or_none()
    if not bundle:
        raise HTTPException(400, "bundle not found")
    mapping = json.loads(mapping_json)
    ghl_target = GhlTarget(**json.loads(ghl_target_json))
    raw = await file.read()
    df = pd.read_csv(io.BytesIO(raw))

    run = Run(
        model=model,
        provider=provider,
        bundle_id=bundle_id,
        source="csv",
        max_parallel=max_parallel,
        streaming=streaming,
        ghl_target=ghl_target.model_dump(),
        status="pending",
    )
    session.add(run)
    await session.flush()

    for _, row in df.iterrows():
        canon: dict[str, Any] = {f: None for f in CANONICAL_FIELDS}
        extra: dict[str, Any] = {}
        for col, target in mapping.items():
            if col not in row:
                continue
            val = row[col]
            if pd.isna(val):
                val = None
            elif not isinstance(val, str):
                val = str(val)
            if target in CANONICAL_FIELDS:
                canon[target] = val
            elif target.startswith("extra."):
                extra[target[len("extra.") :]] = val
        session.add(
            Lead(
                run_id=run.id,
                source="csv",
                raw={k: (None if pd.isna(v) else v) for k, v in row.to_dict().items()},
                extra=extra,
                **canon,
            )
        )
    await session.flush()
    return run


@router.get("/{run_id}/stream")
async def stream_run(run_id: int):
    async with session_scope() as s:
        run = (await s.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
        if not run:
            raise HTTPException(404, "run not found")
        provider = run.provider
        api_key = await _get(s, provider)
        if not api_key:
            raise HTTPException(400, f"{provider} key not set")
        ghl_pit = await _get(s, "ghl_pit")
        ghl_loc = await _get(s, "ghl_location_id")

    gen = sifter.run_sift(
        run_id, provider, api_key, ghl_pit=ghl_pit, ghl_location=ghl_loc
    )
    return sse_response(gen)
