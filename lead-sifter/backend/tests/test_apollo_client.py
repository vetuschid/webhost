from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from app.services import apollo


@pytest.mark.asyncio
async def test_search_people_paginates_until_short_page(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="POST",
        url="https://api.apollo.io/api/v1/mixed_people/search",
        json={"people": [{"id": str(i)} for i in range(100)]},
    )
    httpx_mock.add_response(
        method="POST",
        url="https://api.apollo.io/api/v1/mixed_people/search",
        json={"people": [{"id": "x"}]},
    )
    rows = await apollo.search_people("k", per_page=100, max_pages=5)
    assert len(rows) == 101  # 100 + 1, stopped because page 2 was short


@pytest.mark.asyncio
async def test_search_people_raises_on_non_200(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        method="POST",
        url="https://api.apollo.io/api/v1/mixed_people/search",
        status_code=403,
        json={"error": "forbidden"},
    )
    with pytest.raises(apollo.ApolloError):
        await apollo.search_people("k", per_page=100, max_pages=1)


def test_to_canonical_maps_apollo_payload():
    p = {
        "id": "p1",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@acme.io",
        "title": "VP RevOps",
        "linkedin_url": "https://linkedin.com/in/jane",
        "phone_numbers": [{"sanitized_number": "+15555555555"}],
        "organization": {"name": "Acme", "primary_domain": "acme.io"},
        "city": "Boston",
        "state": "MA",
        "country": "USA",
    }
    c = apollo.to_canonical(p)
    assert c["company"] == "Acme"
    assert c["domain"] == "acme.io"
    assert c["phone"] == "+15555555555"
    assert c["external_id"] == "p1"
