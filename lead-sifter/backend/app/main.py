from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ensure_master_key, get_settings
from .db import init_db
from .routers import chat, context, ghl, keys, leads, runs


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_master_key()
    await init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Lead Sifter", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(keys.router)
    app.include_router(context.router)
    app.include_router(leads.router)
    app.include_router(runs.router)
    app.include_router(ghl.router)
    app.include_router(chat.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
