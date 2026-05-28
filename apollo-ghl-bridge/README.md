# Apollo List → GoHighLevel bridge

Pulls an **already intent+ICP-qualified Apollo List**, re-verifies each record against
config-driven ICP rules, normalizes + dedupes, and upserts the survivors into GoHighLevel.
**Dry-run is the default** — it logs every create/update/tag/skip/error decision and makes
zero writes until you explicitly pass `--live`.

## Why it's built this way (the important corrections)

- **Apollo buying intent is UI-only.** It is not exposed in the API (no intent filter, no intent
  field in search responses). So qualification happens in the Apollo UI: you build a List of
  intent+ICP prospects, and this tool treats that List as the source of truth.
- **Two different Apollo "search" endpoints.** We use `POST /api/v1/contacts/search`
  (your *saved* contacts, with enriched emails), **not** `/mixed_people/search` (the 210M
  net-new DB, which returns no emails and knows nothing about your Lists). List IDs come from
  `GET /api/v1/labels`. All three require an Apollo **master** key (standard keys 403).
- **GoHighLevel V2 only.** Base `https://services.leadconnectorhq.com`, every call sends
  `Authorization: Bearer <PIT>` **and** `Version: 2021-07-28`. Upsert is `POST /contacts/upsert`.
- **GHL does the contact matching, not this app.** `/contacts/upsert` has no matching key; it
  identifies an existing contact by email/phone according to the **location-level "Allow
  Duplicate Contact" setting**. Configure that in GHL. (The app's own dedupe only collapses
  duplicates *within a single pull*.)
- **Contact custom fields must pre-exist in GHL.** The v2 Custom Fields API can't create
  Contact fields. Create them in the GHL UI, copy their IDs into `config.json`, and the app
  only writes *values*.
- `apollo_search_source.js` is a **future stub** — recreating intent via the search API is
  impossible, so it's left inert behind the adapter interface, not wired in.

## Before you run — checklist

1. **Apollo master key** (not a standard key).
2. Your **Apollo List built in the UI** with the intent + ICP filters applied.
3. **GHL sub-account Private Integration Token** (Settings → Private Integrations), scoped to
   View/Edit Contacts + View Custom Fields.
4. **GHL Location ID** and the location's **duplicate-detection setting** configured.
5. **Pre-created GHL Contact custom fields** (e.g. Apollo Source, ICP Score, VIP Reason) — copy
   their field IDs into `config.json`.

## Setup

```bash
cd apollo-ghl-bridge
npm install
cp .env.example .env            # fill APOLLO_MASTER_KEY, GHL_PIT, GHL_LOCATION_ID
cp config.example.json config.json   # set listName, tags, customFields IDs, ICP rules
```

## Run

```bash
# DRY-RUN (default, zero writes) — pull the Apollo List and log every decision
node index.js
npm run dry

# DRY-RUN from a CSV instead (no keys needed) — great first smoke test
node index.js --source csv --csv samples/apollo-list-export.csv

# LIVE sync to GHL (writes!) — validated for required keys before any write
node index.js --live
npm run sync

# Useful flags
node index.js --live --limit 10        # only the first 10 qualified records
node runs/dry_run.js                    # explicit dry-run entry
node runs/sync_to_ghl.js                # explicit live entry
```

Every run writes a full decision trail to `logs/sync_log.json` (summary counts + per-record
entries with reasons/score/IDs/errors).

## How a record flows

```
source (apollo_list | csv)
  → normalize        (canonical contact shape)
  → dedupe           (email, then domain — within this pull only)
  → ICP verify       (scoring/icp_rules.js → {qualified, score, reasons})
  → qualified?  no  → SKIP (logged with reasons)
                yes → upsert contact + tags (+ custom field values)
                       dry-run: logged only, no HTTP call
```

## Config reference (`config.json`)

| Key | Meaning |
|---|---|
| `apollo.listName` | Exact name of the Apollo List to pull (matched against `/labels`). |
| `apollo.perPage` / `maxPages` | Pagination for `/contacts/search` (100/page max). |
| `csv.path` / `csv.mapping` | Fallback CSV path + column→canonical-field mapping. |
| `icp.*` | ICP rules: `requireFields`, `titleIncludesAny`, `titleExcludesAny`, `allowedCountries`, `excludeDomains`, `minEmployees`/`maxEmployees`, `weights`, `minScore`. |
| `ghl.locationId` | Location ID (env `GHL_LOCATION_ID` wins if set). |
| `ghl.tags` | Tags applied to every synced contact (e.g. `VIP_INTENT_ICP_TEST`). |
| `ghl.useSeparateTagCall` | `false` = tags ride in the upsert body (default); `true` = separate `/contacts/{id}/tags` call. |
| `ghl.customFields` | Array of `{ id, value }` (static) or `{ id, from }` (derived: `score`, `reasons`, or any contact field). Entries whose `id` still says `REPLACE_WITH…` are skipped. |

## Structure

```
apollo-ghl-bridge/
├── index.js                      # CLI dispatcher (default = dry-run)
├── config.example.json           # copy → config.json
├── .env.example                  # copy → .env
├── lib/
│   ├── http.js                   # fetch + 429/5xx backoff
│   ├── normalize.js              # raw → canonical contact
│   ├── dedupe.js                 # in-batch email→domain dedupe
│   ├── logger.js                 # decision log → logs/sync_log.json
│   └── config.js                 # config/env/arg loading
├── sources/
│   ├── apollo_list_source.js     # /labels + /contacts/search
│   ├── csv_source.js             # CSV fallback
│   └── apollo_search_source.js   # FUTURE STUB (inert)
├── scoring/
│   └── icp_rules.js              # config-driven ICP verifier
├── destinations/
│   ├── ghl_contacts.js           # /contacts/upsert (V2)
│   └── ghl_tags.js               # /contacts/{id}/tags (V2)
├── runs/
│   ├── pipeline.js               # shared orchestration
│   ├── dry_run.js                # entry: dry-run
│   └── sync_to_ghl.js            # entry: live
├── logs/sync_log.json            # generated per run (gitignored)
├── samples/apollo-list-export.csv
└── test/                         # node --test (12 tests)
```

## Tests

```bash
npm test     # node --test → dedupe, icp_rules, ghl_contacts, normalize
```
