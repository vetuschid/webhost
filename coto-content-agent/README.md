# Coto Content Review Agent

Local-first content review and image revision MVP for Coto Collective.
First client: LensLock (static PNG / JPEG posts and carousel slides).

The MVP runs entirely on your machine. It exposes a localhost dashboard and a
chat-driven review loop that:

1. Loads images from a client batch folder.
2. Lets the content manager chat feedback into the system.
3. Runs an AI **Review Agent**, **Clarification Agent**, **Revision Prompt Agent**, **Image Generation Agent**, and **QA Agent** per image.
4. Retries failed edits once with an improved prompt.
5. Flags low-confidence or repeat failures for human approval.
6. Logs every prompt, decision, output, and approval so future agents can learn.

Scheduling, payments, auth, and GoHighLevel integration are deliberately
**not** in scope yet — clean stubs are wired so they can be added later.

---

## Quick start

```bash
cd coto-content-agent
cp .env.example .env       # add OPENAI_API_KEY and/or ANTHROPIC_API_KEY
npm install
npm run seed               # idempotent; creates data/clients/lenslock + batch_001
npm run dev                # http://localhost:3000
```

### Add images

Drop PNG / JPEG files into the originals folder:

```
data/clients/lenslock/batches/batch_001/originals/
```

Open the batch page — files are auto-ingested into the manifest with
normalized filenames (`batch_001_slide_001_original.png`, etc.). Originals are
never deleted.

### First test run

1. Open `http://localhost:3000`.
2. Click into **lenslock → batch_001**.
3. Paste batch feedback into the chat:
   ```
   Slide 1: Make the smallest text easier to read, but preserve the design style.
   Slide 2: Keep all wording exactly the same, but make the main body text approximately 20 percent larger.
   Slide 3: Make sure the LensLock logo stays exact and clean. Do not alter it.
   Slide 4: Move the CTA slightly higher and make it more readable.
   Slide 5: Preserve the same layout, but improve clarity and sharpness.
   ```
4. Click **Run AI review on all** → review markdown drops into
   `data/clients/lenslock/batches/batch_001/ai_reviews/`.
5. Click **Generate clarifying questions (all)** → per-image questions land
   in `clarifying_questions/`.
6. Click **Generate revision prompts (all)** → one dedicated prompt per
   image in `revision_prompts/`.
7. Click **Run image provider (all)**. With `DEFAULT_IMAGE_PROVIDER=prompt_only`
   this writes payload files; switch to `openai_image` and re-run to actually
   regenerate.
8. Open an image, click **Run QA (auto-retry)** to compare the output to the
   original and retry once if it fails.
9. Approve / reject / needs-revision — approvals land in
   `approved/` plus `approval_log.json`.

---

## File schema (the source of truth)

```
data/
└── clients/
    └── lenslock/
        ├── brand_rules.md
        ├── review_criteria.md
        ├── asset_registry.md
        ├── prompt_rules.md
        ├── mistakes_log.md
        ├── reference_assets/
        │   ├── logos/
        │   ├── people/
        │   └── brand_examples/
        └── batches/
            └── batch_001/
                ├── batch_manifest.json
                ├── batch_chat.md
                ├── approval_log.json
                ├── originals/
                ├── human_feedback/
                ├── ai_reviews/
                ├── clarifying_questions/
                ├── revision_prompts/
                ├── generated_outputs/
                ├── qa_reviews/
                ├── approved/
                ├── rejected/
                └── logs/
```

Hermes / Salvador can read this same folder unchanged — that's the A/B test
seam.

## Filename conventions

```
batch_001_slide_001_original.png
batch_001_slide_001_prompt_v1.md
batch_001_slide_001_output_v1.png
batch_001_slide_001_qa_v1.md
batch_001_slide_001_prompt_v2.md
batch_001_slide_001_output_v2.png
batch_001_slide_001_final.png     # only for approved
```

## Providers

| Kind  | Provider             | Status                                  |
| ----- | -------------------- | --------------------------------------- |
| LLM   | `openai`             | live (uses `OPENAI_API_KEY`)            |
| LLM   | `anthropic`          | live (uses `ANTHROPIC_API_KEY`)         |
| LLM   | `openrouter`         | live (uses `OPENROUTER_API_KEY`)        |
| Image | `prompt_only`        | writes payload, no API call             |
| Image | `openai_image`       | live (`gpt-image-1` via OpenAI)         |
| Image | `higgsfield_stub`    | writes payload, awaits real API access  |

Switch via `.env` (`DEFAULT_LLM_PROVIDER`, `DEFAULT_IMAGE_PROVIDER`) or by
editing a batch's manifest (`llm_provider`, `image_provider`).

## Connector stubs (ready for later)

- `slack`        — webhook stub. Set `SLACK_WEBHOOK_URL` to wire it.
- `google_drive` — interface only; needs OAuth setup before it ships.
- `dropbox`      — interface only.
- `email`        — placeholder.
- `gohighlevel`  — placeholder for caption pairing + scheduling.

## Statuses

```
uploaded → ai_reviewed → awaiting_human_feedback → clarification_needed
       → clarification_answered → revision_prompt_created
       → regeneration_pending → regenerated
       → qa_passed | qa_failed → retry_generated
       → needs_human_review | approved | rejected | delivered
```

## Mac vs Raspberry Pi

- macOS: standard Node 20+ install. Tested on Apple Silicon.
- Raspberry Pi 4/5 with 64-bit Raspberry Pi OS: install Node 20+ from NodeSource:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
  Then follow the Quick start. The Next.js build is the only heavy step; once
  built, `npm start` runs comfortably on a Pi.

## What's deliberately not done yet

- No user auth — `ACTIVE_USER` env var selects the role.
- No post scheduling — GHL is a stub.
- No multi-tenant SaaS — single workspace.
- No DB — JSON + markdown on disk only.

These are deferred until the review-and-regenerate loop is proven on real
LensLock batches.
