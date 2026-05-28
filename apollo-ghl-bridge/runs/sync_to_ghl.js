// Live sync: writes to GoHighLevel. Requires GHL_PIT + location id (and
// APOLLO_MASTER_KEY for the apollo source). Validated before any writes.
//   node runs/sync_to_ghl.js [--source apollo|csv] [--csv <file>] [--limit N]

import 'dotenv/config';
import { parseArgs } from '../lib/config.js';
import { run } from './pipeline.js';

const args = parseArgs();
run({ ...args, dryRun: false }).catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
