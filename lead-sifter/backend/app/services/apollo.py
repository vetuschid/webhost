from __future__ import annotations

import asyncio
from typing import Any

import httpx

APOLLO_BASE = "https://api.apollo.io/api/v1"
USER_AGENT = "lead-sifter/0.1"


class ApolloError(RuntimeError):
    pass


def _headers(api_key: str) -> dict[str, str]:
    return {
        "X-Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache",
    }


async def _post_with_backoff(
    client: httpx.AsyncClient, url: str, headers: dict[str, str], json: dict[str, Any]
) -> httpx.Response:
    delay = 1.0
    for attempt in range(4):
        r = await client.post(url, headers=headers, json=json)
        if r.status_code == 429:
            retry_after = float(r.headers.get("Retry-After", delay))
            await asyncio.sleep(retry_after)
            delay *= 2
            continue
        return r
    return r  # type: ignore[return-value]


async def test_key(api_key: str) -> tuple[bool, str]:
    """Cheap call to verify the master key works. Apollo's auth-health endpoint."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as h:
            r = await h.get(f"{APOLLO_BASE}/auth/health", headers=_headers(api_key))
            if r.status_code == 200:
                return True, "ok"
            return False, f"HTTP {r.status_code}: {r.text[:300]}"
    except Exception as e:
        return False, str(e)


async def search_people(
    api_key: str,
    *,
    person_titles: list[str] | None = None,
    person_locations: list[str] | None = None,
    organization_locations: list[str] | None = None,
    organization_num_employees_ranges: list[str] | None = None,
    q_keywords: str | None = None,
    per_page: int = 100,
    max_pages: int = 5,
) -> list[dict[str, Any]]:
    per_page = max(1, min(100, per_page))
    max_pages = max(1, min(500, max_pages))
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=60.0) as h:
        for page in range(1, max_pages + 1):
            payload: dict[str, Any] = {"page": page, "per_page": per_page}
            if person_titles:
                payload["person_titles"] = person_titles
            if person_locations:
                payload["person_locations"] = person_locations
            if organization_locations:
                payload["organization_locations"] = organization_locations
            if organization_num_employees_ranges:
                payload["organization_num_employees_ranges"] = organization_num_employees_ranges
            if q_keywords:
                payload["q_keywords"] = q_keywords
            r = await _post_with_backoff(
                h, f"{APOLLO_BASE}/mixed_people/search", _headers(api_key), payload
            )
            if r.status_code != 200:
                raise ApolloError(f"Apollo search failed HTTP {r.status_code}: {r.text[:500]}")
            data = r.json()
            people = data.get("people") or data.get("contacts") or []
            if not people:
                break
            results.extend(people)
            if len(people) < per_page:
                break
    return results


async def bulk_match(api_key: str, people: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Enrich up to 10 people per call. `people` items pass through Apollo's match params."""
    enriched: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=60.0) as h:
        for i in range(0, len(people), 10):
            batch = people[i : i + 10]
            payload = {"details": batch, "reveal_personal_emails": False}
            r = await _post_with_backoff(
                h, f"{APOLLO_BASE}/people/bulk_match", _headers(api_key), payload
            )
            if r.status_code != 200:
                raise ApolloError(f"Apollo enrich failed HTTP {r.status_code}: {r.text[:500]}")
            data = r.json()
            matches = data.get("matches") or []
            enriched.extend(matches)
    return enriched


def to_canonical(person: dict[str, Any]) -> dict[str, Any]:
    org = person.get("organization") or {}
    phones = person.get("phone_numbers") or []
    phone = None
    if phones:
        phone = phones[0].get("sanitized_number") or phones[0].get("raw_number")
    return {
        "external_id": person.get("id"),
        "first_name": person.get("first_name"),
        "last_name": person.get("last_name"),
        "email": person.get("email"),
        "phone": phone,
        "title": person.get("title"),
        "company": org.get("name"),
        "domain": org.get("primary_domain") or org.get("website_url"),
        "linkedin_url": person.get("linkedin_url"),
        "city": person.get("city"),
        "state": person.get("state"),
        "country": person.get("country"),
        "raw": person,
        "extra": {},
    }
