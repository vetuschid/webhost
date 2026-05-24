from __future__ import annotations

from app.services import ghl_mcp


def test_match_tool_prefers_fallback_name():
    tools = ["contacts_upsert-contact", "something_else"]
    assert ghl_mcp._match_tool(tools, "upsert_contact") == "contacts_upsert-contact"


def test_match_tool_falls_back_to_keywords():
    tools = ["custom_create_contact_upsert_v2"]
    assert ghl_mcp._match_tool(tools, "upsert_contact") == "custom_create_contact_upsert_v2"


def test_match_tool_returns_none_when_no_match():
    assert ghl_mcp._match_tool(["unrelated"], "add_tags") is None


def test_extract_list_handles_string_json_content():
    res = {"content": ['{"pipelines": [{"id": "p1"}, {"id": "p2"}]}']}
    assert ghl_mcp._extract_list(res, ["pipelines"]) == [{"id": "p1"}, {"id": "p2"}]


def test_first_contact_id_walks_nested_shapes():
    res = {"content": ['{"contact": {"id": "c123"}}']}
    assert ghl_mcp._first_contact_id(res) == "c123"
