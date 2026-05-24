from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import frontmatter

ALLOWED_EXTS = {".md", ".txt", ".json"}


@dataclass
class LoadedBundle:
    content: str
    sources: list[str]
    content_hash: str
    output_schema: dict[str, Any]
    qualified_field: str


def _walk(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in ALLOWED_EXTS)


def _extract_output_schema(text: str) -> dict[str, Any]:
    """Find a section titled `## Output Schema` (case-insensitive) and parse the first
    fenced JSON block under it. Returns {} if not found."""
    pattern = re.compile(
        r"##\s*Output Schema\s*\n+```(?:json)?\s*\n(.*?)\n```",
        re.IGNORECASE | re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}


def _extract_qualified_field(text: str) -> str | None:
    """Look for `qualified_field: <name>` in YAML frontmatter or anywhere in the doc."""
    m = re.search(r"qualified_field\s*[:=]\s*([A-Za-z_][\w]*)", text)
    return m.group(1) if m else None


def load_from_folder(folder_path: str) -> LoadedBundle:
    folder = Path(folder_path).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise FileNotFoundError(f"Folder not found: {folder}")
    files = _walk(folder)
    if not files:
        raise ValueError(f"No .md/.txt/.json files in {folder}")
    sections: list[str] = []
    sources: list[str] = []
    for f in files:
        try:
            raw = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raw = f.read_text(encoding="utf-8", errors="replace")
        try:
            post = frontmatter.loads(raw)
            body = post.content
        except Exception:
            body = raw
        sections.append(f"# === FILE: {f.relative_to(folder)} ===\n\n{body}")
        sources.append(str(f))
    content = "\n\n".join(sections)
    return _finalize(content, sources)


def load_from_inline(files: list[dict[str, str]]) -> LoadedBundle:
    sections = []
    sources = []
    for entry in files:
        name = entry.get("name") or "untitled"
        body = entry.get("content", "")
        sections.append(f"# === FILE: {name} ===\n\n{body}")
        sources.append(f"inline:{name}")
    if not sections:
        raise ValueError("No inline files provided")
    return _finalize("\n\n".join(sections), sources)


def _finalize(content: str, sources: list[str]) -> LoadedBundle:
    qfield = _extract_qualified_field(content) or "qualified"
    schema = _extract_output_schema(content)
    h = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return LoadedBundle(
        content=content,
        sources=sources,
        content_hash=h,
        output_schema=schema,
        qualified_field=qfield,
    )
