// Single-record smoke test against REAL Apollo + GoHighLevel APIs.
// Defaults to dry-run; pass --live to actually write one contact.
//
//   node scripts/live_smoke.js               # dry-run, 1 record
//   node scripts/live_smoke.js --live        # writes 1 contact to GHL
//   node scripts/live_smoke.js --live --limit 3
//
// Use after preflight passes, before a full sync. Verifies the full pipeline
// end-to-end (Apollo list pull → ICP verify → GHL upsert) on minimum volume.

import 'dotenv/config';
import { parseArgs } from '../lib/config.js';
import { run } from '../runs/pipeline.js';

const args = parseArgs();
const limit = args.limit && args.limit > 0 ? args.limit : 1;

console.log(
  `Smoke test — mode=${args.dryRun ? 'DRY-RUN' : 'LIVE'} limit=${limit} (use --live to write).`,
);

run({ ...args, source: 'apollo', limit }).catch((e) => {
  console.error('Smoke test failed:', e.message);
  process.exit(1);
});
