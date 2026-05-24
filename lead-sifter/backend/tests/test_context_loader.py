from __future__ import annotations

from pathlib import Path

from app.services import context_loader


def test_load_from_folder_concatenates_and_extracts_schema(tmp_path: Path):
    (tmp_path / "00-overview.md").write_text("# Overview\n\nA healthcare SaaS ICP.")
    (tmp_path / "99-schema.md").write_text(
        "## Output Schema\n\n```json\n"
        '{"type":"object","properties":{"qualified":{"type":"boolean"}},'
        '"required":["qualified"]}\n```\n'
    )
    bundle = context_loader.load_from_folder(str(tmp_path))
    assert "FILE: 00-overview.md" in bundle.content
    assert "FILE: 99-schema.md" in bundle.content
    assert bundle.output_schema["properties"]["qualified"]["type"] == "boolean"
    assert bundle.qualified_field == "qualified"
    assert len(bundle.content_hash) == 64


def test_qualified_field_override(tmp_path: Path):
    (tmp_path / "a.md").write_text("qualified_field: is_fit\n\nbody")
    bundle = context_loader.load_from_folder(str(tmp_path))
    assert bundle.qualified_field == "is_fit"


def test_inline_no_schema_defaults_qualified(tmp_path: Path):
    b = context_loader.load_from_inline([{"name": "a.md", "content": "just prose"}])
    assert b.output_schema == {}
    assert b.qualified_field == "qualified"
