// CLI dispatcher. Default is DRY-RUN (safe). Pass --live to write to GHL.
//
//   node index.js                          # dry-run, apollo source
//   node index.js --source csv --csv f.csv # dry-run from a CSV
//   node index.js --live                   # LIVE sync to GHL
//   node index.js --live --limit 10        # LIVE, first 10 only

import 'dotenv/config';
import { parseArgs } from './lib/config.js';
import { run } from './runs/pipeline.js';

const args = parseArgs();
run(args).catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
