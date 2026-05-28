// Dry run: zero writes. Logs every create/update/tag/skip/error decision.
//   node runs/dry_run.js [--source apollo|csv] [--csv <file>] [--limit N]

import 'dotenv/config';
import { parseArgs } from '../lib/config.js';
import { run } from './pipeline.js';

const args = parseArgs();
run({ ...args, dryRun: true }).catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
