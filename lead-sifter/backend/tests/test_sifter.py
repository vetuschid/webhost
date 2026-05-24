from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pytest

from app.services import sifter


SCHEMA = {
    "type": "object",
    "properties": {
        "qualified": {"type": "boolean"},
        "reasoning": {"type": "string"},
    },
    "required": ["qualified", "reasoning"],
    "additionalProperties": False,
}


@pytest.mark.asyncio
async def test_evaluate_lead_happy_path():
    async def fake(provider, key, model, system, user):
        return json.dumps({"qualified": True, "reasoning": "fits ICP"}), None

    with patch("app.services.sifter.llm.complete_json", side_effect=fake):
        parsed, raw, err = await sifter._evaluate_lead(
            "openai", "k", "gpt-4o", "sys", {"email": "a@b.com"}, SCHEMA
        )
    assert err is None
    assert parsed == {"qualified": True, "reasoning": "fits ICP"}


@pytest.mark.asyncio
async def test_evaluate_lead_retries_on_schema_failure():
    calls: list[str] = []

    async def fake(provider, key, model, system, user):
        calls.append(user)
        # First call returns wrong shape; second returns correct
        if len(calls) == 1:
            return json.dumps({"qualified": "yes"}), None
        return json.dumps({"qualified": True, "reasoning": "ok"}), None

    with patch("app.services.sifter.llm.complete_json", side_effect=fake):
        parsed, raw, err = await sifter._evaluate_lead(
            "openai", "k", "gpt-4o", "sys", {"email": "a@b.com"}, SCHEMA
        )
    assert err is None
    assert parsed["qualified"] is True
    assert len(calls) == 2
    assert "did not match the schema" in calls[1]


@pytest.mark.asyncio
async def test_evaluate_lead_marks_errored_after_persistent_failure():
    async def fake(provider, key, model, system, user):
        return "not json at all", None

    with patch("app.services.sifter.llm.complete_json", side_effect=fake):
        parsed, raw, err = await sifter._evaluate_lead(
            "openai", "k", "gpt-4o", "sys", {"email": "a@b.com"}, SCHEMA
        )
    assert err is not None
    assert "JSON parse failure" in err


def test_build_system_prompt_embeds_schema_and_qualified_field():
    p = sifter.build_system_prompt("CTX BODY", SCHEMA, "qualified")
    assert "CTX BODY" in p
    assert "qualified" in p
    assert "Output Schema" in p
