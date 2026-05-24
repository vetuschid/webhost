# Lead Sifter (Phase 1)

Local-first lead qualification tool. Pull leads from Apollo (API or CSV), evaluate each one
against a user-defined ICP context bundle with OpenAI or Anthropic, and push the qualified leads
into GoHighLevel via its official MCP server.

Phase 1 is intentionally single-user, local-only, no background workers. The architecture is
laid out so phases 2+ can add a job queue, scheduled syncs, and a scoring model service without
ripping things out.

## Quick start

### With Docker

```bash
docker compose up --build
```

Backend → `http://localhost:8000`, frontend → `http://localhost:5173`.
The SQLite DB and Fernet master key live in a named volume `lead-sifter-data` (mounted at
`/data` inside the backend container).

### Without Docker (two terminals)

```bash
# terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

```bash
# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

## Where keys are stored

On first run, Lead Sifter creates `~/.lead-sifter/master.key` (Fernet symmetric key, chmod
600) and `~/.lead-sifter/data.db` (SQLite). API keys are encrypted with the master key — only
the last 4 characters are ever shown after save.

To reset, delete the folder. To move installs, copy the folder.

## Getting the credentials Lead Sifter needs

| Provider | What you need | Where to get it |
|---|---|---|
| OpenAI | API key (`sk-…`) | <https://platform.openai.com/api-keys> |
| Anthropic | API key (`sk-ant-…`) | <https://console.anthropic.com/settings/keys> |
| Apollo | **Master** API key | Apollo settings → Integrations → API → "Master API key". The per-call rate limit and credit cost is on your plan; the master key is required for `mixed_people/search`. |
| GoHighLevel | Private Integration Token (PIT) | Sub-account → Settings → Private Integrations → Create with `contacts.write`, `opportunities.write`, `contacts.readonly`, `workflows.readonly`, `tags.readonly` scopes (exact list depends on which features you enable). |
| GoHighLevel | Location ID | URL in the GHL UI: `https://app.gohighlevel.com/v2/location/<locationId>/…` |

## End-to-end flow

1. Open **Setup**, paste each key, click **Save**, then **Test** to verify.
2. Open **Context** → load a folder of `.md` files describing your ICP. Include a fenced JSON
   block under `## Output Schema` to enforce structured output. See
   `samples/context-bundles/healthcare-saas/` for a working example.
3. Open **Run** → pick a model, pick the bundle, choose Apollo search **or** CSV upload, pick
   a GHL target (pipeline / stage / tags / workflow), set max parallel calls, **Start run**.
4. Watch the live SSE table. When the run finishes you see a summary. Selected leads are
   already pushed to GHL; use the **History** page to re-push or push a manual selection.

## GHL MCP tool discovery

Tool names are not hardcoded. On first connection the backend calls `tools/list` on
`https://services.leadconnectorhq.com/mcp/`, then matches capability → name using:

1. A known fallback list (e.g. `contacts_upsert-contact`, `opportunities_create-opportunity`,
   `contacts_add-tags`, `workflows_add-contact-to-workflow`).
2. Keyword matching on the live tool list if the fallback name is missing.

Cached for 5 minutes per `(PIT, locationId)`. Hit `GET /ghl/tool-map?refresh=true` (Bruno
collection has this) to see what the backend resolved.

## Apollo specifics

- Endpoint of record for prospecting: `POST /api/v1/mixed_people/search`.
  Pagination cap: 100 per page, 500 pages, 50k results per query.
- Email enrichment is **opt-in** because it consumes credits. The Run page shows a
  confirmation dialog before running `POST /api/v1/people/bulk_match` (max 10 per call,
  chunked automatically).
- 429s are retried with `Retry-After` + exponential backoff (1s → 2s → 4s → 8s, max 4 tries).

## Concurrency & rate limits

- Per-run LLM concurrency is bounded by an `asyncio.Semaphore` (default 5, cap 20).
- GHL calls are gated by a shared `asyncio.Semaphore(8)` + token-bucket limiter:
  100 req / 10s, 200k req / day per the published GHL limits.

## Schema validation

Each context bundle declares an output schema (JSON Schema, draft 2020-12). The sifter
validates the model's JSON response against it. On failure, it retries **once** with an
explicit "your previous response did not match the schema" follow-up. Persistent failures
are marked `errored` and surfaced in the UI.

## Tests

```bash
cd backend && pytest
cd frontend && npm run test
```

## Out of scope for Phase 1

- Background job queue (no Celery / RQ yet)
- Multi-user / auth
- Webhooks from GHL
- Custom scoring models

These are sketched in `lead-sifter/ARCHITECTURE.md` (TBD) and left as seams in the code.

## Layout

```
lead-sifter/
├── backend/    # FastAPI + SQLAlchemy + httpx + mcp SDK
├── frontend/   # Vite + React + Tailwind + TanStack Query
├── samples/    # context bundle, Apollo CSV, Bruno collection
└── docker-compose.yml
```
