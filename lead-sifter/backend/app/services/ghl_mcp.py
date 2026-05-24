from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from ..ratelimit import GHL_SEM, ghl_gate

GHL_MCP_URL = "https://services.leadconnectorhq.com/mcp/"

CAPABILITY_FALLBACKS = {
    "upsert_contact": ["contacts_upsert-contact", "contacts_create-contact"],
    "create_opportunity": ["opportunities_create-opportunity"],
    "add_tags": ["contacts_add-tags"],
    "add_to_workflow": ["workflows_add-contact-to-workflow", "contacts_add-to-workflow"],
    "list_pipelines": ["opportunities_list-pipelines", "pipelines_list"],
    "list_tags": ["locations_list-tags", "tags_list"],
    "list_workflows": ["workflows_list", "locations_list-workflows"],
}

CAPABILITY_KEYWORDS = {
    "upsert_contact": ["upsert", "contact"],
    "create_opportunity": ["create", "opportunity"],
    "add_tags": ["add", "tag"],
    "add_to_workflow": ["add", "workflow"],
    "list_pipelines": ["list", "pipeline"],
    "list_tags": ["list", "tag"],
    "list_workflows": ["list", "workflow"],
}


@dataclass
class _ToolCache:
    tools: list[dict[str, Any]]
    mapping: dict[str, str | None]
    fetched_at: float


_cache: dict[tuple[str, str], _ToolCache] = {}
_CACHE_TTL = 300.0


def _headers(pit: str, location_id: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {pit}",
        "locationId": location_id,
    }


@asynccontextmanager
async def session(pit: str, location_id: str):
    async with streamablehttp_client(GHL_MCP_URL, headers=_headers(pit, location_id)) as (
        read,
        write,
        _close,
    ):
        async with ClientSession(read, write) as s:
            await s.initialize()
            yield s


def _match_tool(tool_names: list[str], capability: str) -> str | None:
    # 1. Try fallback names verbatim
    for candidate in CAPABILITY_FALLBACKS.get(capability, []):
        if candidate in tool_names:
            return candidate
    # 2. Keyword match (all keywords must appear in name, case-insensitive)
    kws = [k.lower() for k in CAPABILITY_KEYWORDS.get(capability, [])]
    for name in tool_names:
        lower = name.lower()
        if all(k in lower for k in kws):
            return name
    return None


async def discover(pit: str, location_id: str, force: bool = False) -> _ToolCache:
    key = (pit, location_id)
    cached = _cache.get(key)
    if cached and not force and (time.monotonic() - cached.fetched_at) < _CACHE_TTL:
        return cached
    async with session(pit, location_id) as s:
        listing = await s.list_tools()
        tools_raw = [
            {"name": t.name, "description": t.description or ""} for t in listing.tools
        ]
    names = [t["name"] for t in tools_raw]
    mapping = {cap: _match_tool(names, cap) for cap in CAPABILITY_FALLBACKS.keys()}
    entry = _ToolCache(tools=tools_raw, mapping=mapping, fetched_at=time.monotonic())
    _cache[key] = entry
    return entry


async def test_connection(pit: str, location_id: str) -> tuple[bool, str]:
    try:
        async with session(pit, location_id) as s:
            listing = await s.list_tools()
            return True, f"{len(listing.tools)} tools available"
    except Exception as e:
        return False, str(e)


async def call_tool(
    pit: str, location_id: str, tool_name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    async with GHL_SEM:
        await ghl_gate()
        async with session(pit, location_id) as s:
            result = await s.call_tool(tool_name, arguments)
            content_parts: list[Any] = []
            for c in result.content:
                if getattr(c, "type", None) == "text":
                    content_parts.append(c.text)
                else:
                    content_parts.append(getattr(c, "data", None))
            return {
                "isError": bool(getattr(result, "isError", False)),
                "content": content_parts,
            }


# ----- High-level helpers used by the runner -----


async def list_pipelines(pit: str, loc: str) -> list[dict[str, Any]]:
    cache = await discover(pit, loc)
    name = cache.mapping.get("list_pipelines")
    if not name:
        return []
    res = await call_tool(pit, loc, name, {})
    return _extract_list(res, ["pipelines", "data", "items"])


async def list_tags(pit: str, loc: str) -> list[dict[str, Any]]:
    cache = await discover(pit, loc)
    name = cache.mapping.get("list_tags")
    if not name:
        return []
    res = await call_tool(pit, loc, name, {})
    return _extract_list(res, ["tags", "data", "items"])


async def list_workflows(pit: str, loc: str) -> list[dict[str, Any]]:
    cache = await discover(pit, loc)
    name = cache.mapping.get("list_workflows")
    if not name:
        return []
    res = await call_tool(pit, loc, name, {})
    return _extract_list(res, ["workflows", "data", "items"])


def _extract_list(res: dict[str, Any], keys: list[str]) -> list[dict[str, Any]]:
    import json as _json

    for part in res.get("content", []):
        if not isinstance(part, str):
            continue
        try:
            parsed = _json.loads(part)
        except Exception:
            continue
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for k in keys:
                v = parsed.get(k)
                if isinstance(v, list):
                    return v
            return [parsed]
    return []


async def upsert_contact_and_followups(
    pit: str,
    loc: str,
    contact: dict[str, Any],
    pipeline_id: str | None,
    stage_id: str | None,
    tags: list[str],
    workflow_id: str | None,
) -> dict[str, Any]:
    """Run the per-lead push flow. Returns a summary dict with results / errors per step."""
    cache = await discover(pit, loc)
    out: dict[str, Any] = {"steps": {}}
    name = cache.mapping.get("upsert_contact")
    if not name:
        out["error"] = "no upsert_contact tool resolved"
        return out

    upsert_res = await call_tool(pit, loc, name, contact)
    out["steps"]["upsert_contact"] = upsert_res
    contact_id = _first_contact_id(upsert_res)
    if not contact_id:
        out["error"] = "upsert_contact did not return a contactId"
        return out
    out["contact_id"] = contact_id

    if tags:
        tname = cache.mapping.get("add_tags")
        if tname:
            out["steps"]["add_tags"] = await call_tool(
                pit, loc, tname, {"contactId": contact_id, "tags": tags}
            )

    if pipeline_id and stage_id:
        oname = cache.mapping.get("create_opportunity")
        if oname:
            out["steps"]["create_opportunity"] = await call_tool(
                pit,
                loc,
                oname,
                {
                    "contactId": contact_id,
                    "pipelineId": pipeline_id,
                    "pipelineStageId": stage_id,
                    "name": contact.get("name")
                    or f"{contact.get('firstName','')} {contact.get('lastName','')}".strip()
                    or "New opportunity",
                    "status": "open",
                },
            )

    if workflow_id:
        wname = cache.mapping.get("add_to_workflow")
        if wname:
            out["steps"]["add_to_workflow"] = await call_tool(
                pit, loc, wname, {"contactId": contact_id, "workflowId": workflow_id}
            )

    return out


def _first_contact_id(res: dict[str, Any]) -> str | None:
    import json as _json

    for part in res.get("content", []):
        if not isinstance(part, str):
            continue
        try:
            parsed = _json.loads(part)
        except Exception:
            continue
        if isinstance(parsed, dict):
            for k in ("contactId", "id", "contact_id"):
                v = parsed.get(k)
                if isinstance(v, str):
                    return v
            inner = parsed.get("contact") or parsed.get("data")
            if isinstance(inner, dict):
                for k in ("contactId", "id", "contact_id"):
                    v = inner.get(k)
                    if isinstance(v, str):
                        return v
    return None
