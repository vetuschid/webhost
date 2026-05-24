from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crypto
from ..db import get_session
from ..models import ApiKey, Lead
from ..schemas import ApolloFilters, LeadOut
from ..services import apollo

router = APIRouter(prefix="/leads", tags=["leads"])

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


async def _get_value(s: AsyncSession, provider: str) -> str | None:
    row = (
        await s.execute(select(ApiKey).where(ApiKey.provider == provider))
    ).scalar_one_or_none()
    return crypto.decrypt(row.ciphertext) if row else None


@router.post("/apollo/preview")
async def apollo_preview(
    filters: ApolloFilters, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    key = await _get_value(session, "apollo")
    if not key:
        raise HTTPException(400, "Apollo key not set")
    people = await apollo.search_people(
        key,
        person_titles=filters.person_titles or None,
        person_locations=filters.person_locations or None,
        organization_locations=filters.organization_locations or None,
        organization_num_employees_ranges=filters.organization_num_employees_ranges or None,
        q_keywords=filters.q_keywords,
        per_page=filters.per_page,
        max_pages=min(filters.max_pages, 2),  # preview is capped at 2 pages
    )
    sample = [apollo.to_canonical(p) for p in people[:10]]
    return {"count": len(people), "sample": sample}


@router.post("/csv/preview")
async def csv_preview(file: UploadFile = File(...)) -> dict[str, Any]:
    raw = await file.read()
    df = pd.read_csv(io.BytesIO(raw))
    headers = list(df.columns)
    guesses: dict[str, str] = {}
    for h in headers:
        lowered = h.lower().strip().replace(" ", "_")
        for canon in CANONICAL_FIELDS:
            if canon in lowered:
                guesses[h] = canon
                break
        else:
            guesses[h] = f"extra.{lowered}"
    preview = df.head(5).to_dict(orient="records")
    return {"headers": headers, "guessed_mapping": guesses, "preview": preview, "rows": len(df)}


@router.get("", response_model=list[LeadOut])
async def list_leads(
    run_id: int | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[Lead]:
    stmt = select(Lead).order_by(Lead.id.desc()).limit(500)
    if run_id is not None:
        stmt = stmt.where(Lead.run_id == run_id)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)
