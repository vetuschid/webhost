from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import ContextBundle
from ..schemas import ContextBundleIn, ContextBundleOut
from ..services import context_loader

router = APIRouter(prefix="/context", tags=["context"])


@router.get("", response_model=list[ContextBundleOut])
async def list_bundles(session: AsyncSession = Depends(get_session)) -> list[ContextBundle]:
    rows = (
        (await session.execute(select(ContextBundle).order_by(ContextBundle.created_at.desc())))
        .scalars()
        .all()
    )
    return list(rows)


@router.get("/{bundle_id}", response_model=ContextBundleOut)
async def get_bundle(
    bundle_id: int, session: AsyncSession = Depends(get_session)
) -> ContextBundleOut:
    row = (
        await session.execute(select(ContextBundle).where(ContextBundle.id == bundle_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "not found")
    out = ContextBundleOut.model_validate(row)
    out.preview = row.content[:4000]
    return out


@router.post("", response_model=ContextBundleOut)
async def create_bundle(
    body: ContextBundleIn, session: AsyncSession = Depends(get_session)
) -> ContextBundle:
    if body.folder_path:
        loaded = context_loader.load_from_folder(body.folder_path)
    elif body.inline_files:
        loaded = context_loader.load_from_inline(body.inline_files)
    else:
        raise HTTPException(400, "must provide folder_path or inline_files")

    existing = (
        await session.execute(select(ContextBundle).where(ContextBundle.name == body.name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"bundle named '{body.name}' already exists")

    qfield = body.qualified_field or loaded.qualified_field
    row = ContextBundle(
        name=body.name,
        content=loaded.content,
        sources=loaded.sources,
        content_hash=loaded.content_hash,
        output_schema=loaded.output_schema,
        qualified_field=qfield,
    )
    session.add(row)
    await session.flush()
    return row


@router.post("/upload", response_model=ContextBundleOut)
async def upload_bundle(
    name: str = Form(...),
    qualified_field: str | None = Form(default=None),
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
) -> ContextBundle:
    inline = []
    for f in files:
        body = await f.read()
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError:
            text = body.decode("utf-8", errors="replace")
        inline.append({"name": f.filename or "untitled", "content": text})
    loaded = context_loader.load_from_inline(inline)
    existing = (
        await session.execute(select(ContextBundle).where(ContextBundle.name == name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"bundle named '{name}' already exists")
    qfield = qualified_field or loaded.qualified_field
    row = ContextBundle(
        name=name,
        content=loaded.content,
        sources=loaded.sources,
        content_hash=loaded.content_hash,
        output_schema=loaded.output_schema,
        qualified_field=qfield,
    )
    session.add(row)
    await session.flush()
    return row


@router.delete("/{bundle_id}")
async def delete_bundle(
    bundle_id: int, session: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    row = (
        await session.execute(select(ContextBundle).where(ContextBundle.id == bundle_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "not found")
    await session.delete(row)
    return {"status": "deleted"}
