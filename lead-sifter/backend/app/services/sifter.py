from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from sqlalchemy import select

from ..db import session_scope
from ..models import ContextBundle, Lead, LeadResult, Run
from . import ghl_mcp, llm
from .llm import Provider


def _strip_code_fence(text: str) -> str:
    m = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
    return m.group(1) if m else text


def _validate(output: dict[str, Any], schema: dict[str, Any]) -> str | None:
    if not schema:
        return None
    try:
        Draft202012Validator(schema).validate(output)
        return None
    except ValidationError as e:
        return e.message


def build_system_prompt(bundle_content: str, schema: dict[str, Any], qualified_field: str) -> str:
    base = (
        "You are a lead qualification engine. Read the context below and evaluate each "
        "lead strictly against it. Respond with a single JSON object only — no prose, "
        "no markdown fences. The JSON MUST conform to the output schema. The field "
        f"`{qualified_field}` MUST be a boolean indicating whether the lead is a good fit.\n\n"
    )
    schema_text = ""
    if schema:
        schema_text = (
            "## Output Schema (JSON Schema, draft 2020-12)\n\n"
            f"```json\n{json.dumps(schema, indent=2)}\n```\n\n"
        )
    return base + schema_text + "## Context\n\n" + bundle_content


async def _evaluate_lead(
    provider: Provider,
    api_key: str,
    model: str,
    system: str,
    lead: dict[str, Any],
    schema: dict[str, Any],
) -> tuple[dict[str, Any] | None, str, str | None]:
    """Returns (parsed_output, raw_text, error)."""
    user = "Evaluate this lead and return JSON matching the schema:\n\n" + json.dumps(
        lead, default=str
    )
    raw, _ = await llm.complete_json(provider, api_key, model, system, user)
    try:
        parsed = json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError as e:
        # one retry: append the parse error
        retry_user = (
            user + f"\n\nYour previous response failed JSON parsing: {e}. Return valid JSON only."
        )
        raw, _ = await llm.complete_json(provider, api_key, model, system, retry_user)
        try:
            parsed = json.loads(_strip_code_fence(raw))
        except json.JSONDecodeError as e2:
            return None, raw, f"JSON parse failure: {e2}"
    err = _validate(parsed, schema)
    if err:
        retry_user = (
            user
            + f"\n\nYour previous response did not match the schema: {err}. "
            "Return a JSON object that conforms exactly."
        )
        raw, _ = await llm.complete_json(provider, api_key, model, system, retry_user)
        try:
            parsed = json.loads(_strip_code_fence(raw))
        except json.JSONDecodeError as e:
            return None, raw, f"JSON parse failure on retry: {e}"
        err = _validate(parsed, schema)
        if err:
            return parsed, raw, f"Schema validation failure: {err}"
    return parsed, raw, None


def _lead_to_dict(lead: Lead) -> dict[str, Any]:
    return {
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "email": lead.email,
        "phone": lead.phone,
        "title": lead.title,
        "company": lead.company,
        "domain": lead.domain,
        "linkedin_url": lead.linkedin_url,
        "city": lead.city,
        "state": lead.state,
        "country": lead.country,
        "extra": lead.extra,
    }


def _lead_to_ghl_contact(lead: Lead, output: dict[str, Any]) -> dict[str, Any]:
    contact: dict[str, Any] = {
        "firstName": lead.first_name,
        "lastName": lead.last_name,
        "email": lead.email,
        "phone": lead.phone,
        "companyName": lead.company,
        "city": lead.city,
        "state": lead.state,
        "country": lead.country,
        "website": lead.domain,
        "source": "lead-sifter",
        "customFields": [],
    }
    return {k: v for k, v in contact.items() if v not in (None, "", [])}


async def run_sift(
    run_id: int,
    provider: Provider,
    api_key: str,
    *,
    ghl_pit: str | None = None,
    ghl_location: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Async generator that yields SSE-shaped dicts per lead and final summary."""
    async with session_scope() as s:
        run = (await s.execute(select(Run).where(Run.id == run_id))).scalar_one()
        bundle = (
            await s.execute(select(ContextBundle).where(ContextBundle.id == run.bundle_id))
        ).scalar_one()
        leads = (
            (await s.execute(select(Lead).where(Lead.run_id == run_id))).scalars().all()
        )
        run.status = "running"
        await s.flush()
        model = run.model
        max_parallel = run.max_parallel
        bundle_content = bundle.content
        schema = bundle.output_schema or {}
        qfield = bundle.qualified_field or "qualified"
        ghl_target = run.ghl_target or {}

    system = build_system_prompt(bundle_content, schema, qfield)
    sem = asyncio.Semaphore(max(1, min(20, max_parallel)))
    qualified = rejected = errored = pushed = push_failed = 0
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def worker(lead: Lead) -> None:
        nonlocal qualified, rejected, errored, pushed, push_failed
        async with sem:
            await queue.put(
                {"event": "lead", "lead_id": lead.id, "status": "evaluating"}
            )
            lead_payload = _lead_to_dict(lead)
            parsed, raw, err = await _evaluate_lead(
                provider, api_key, model, system, lead_payload, schema
            )
            if err and parsed is None:
                status = "errored"
                errored += 1
            else:
                is_q = bool((parsed or {}).get(qfield))
                status = "qualified" if is_q else "rejected"
                if is_q:
                    qualified += 1
                else:
                    rejected += 1

            ghl_summary: dict[str, Any] = {}
            if status == "qualified" and ghl_pit and ghl_location and ghl_target.get("create_contact", True):
                try:
                    ghl_summary = await ghl_mcp.upsert_contact_and_followups(
                        ghl_pit,
                        ghl_location,
                        _lead_to_ghl_contact(lead, parsed or {}),
                        ghl_target.get("pipeline_id"),
                        ghl_target.get("stage_id"),
                        ghl_target.get("tags") or [],
                        ghl_target.get("workflow_id"),
                    )
                    if "error" in ghl_summary:
                        push_failed += 1
                    else:
                        pushed += 1
                except Exception as e:
                    push_failed += 1
                    ghl_summary = {"error": str(e)}

            async with session_scope() as s2:
                lr = LeadResult(
                    run_id=run_id,
                    lead_id=lead.id,
                    status=status,
                    output=parsed or {},
                    reasoning=(parsed or {}).get("reasoning") if isinstance(parsed, dict) else None,
                    raw_response=raw,
                    error=err,
                    pushed_to_ghl=bool(ghl_summary and "error" not in ghl_summary),
                    ghl_result=ghl_summary,
                )
                s2.add(lr)
                await s2.flush()
                lr_id = lr.id

            await queue.put(
                {
                    "event": "lead",
                    "lead_id": lead.id,
                    "lead_result_id": lr_id,
                    "status": status,
                    "output": parsed,
                    "error": err,
                    "ghl": ghl_summary,
                }
            )

    async def runner() -> None:
        tasks = [asyncio.create_task(worker(l)) for l in leads]
        await asyncio.gather(*tasks, return_exceptions=False)
        await queue.put({"event": "done"})

    runner_task = asyncio.create_task(runner())

    try:
        while True:
            item = await queue.get()
            if item.get("event") == "done":
                break
            yield item
    finally:
        await runner_task

    async with session_scope() as s3:
        run = (await s3.execute(select(Run).where(Run.id == run_id))).scalar_one()
        run.status = "completed"
        run.summary = {
            "total": len(leads),
            "qualified": qualified,
            "rejected": rejected,
            "errored": errored,
            "pushed_to_ghl": pushed,
            "ghl_push_failed": push_failed,
        }
        from datetime import datetime, timezone

        run.finished_at = datetime.now(timezone.utc)

    yield {
        "event": "summary",
        "total": len(leads),
        "qualified": qualified,
        "rejected": rejected,
        "errored": errored,
        "pushed_to_ghl": pushed,
        "ghl_push_failed": push_failed,
    }
