import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadConfig() {
  const p = path.resolve('config.json');
  let text;
  try {
    text = await readFile(p, 'utf8');
  } catch {
    throw new Error(
      `config.json not found at ${p}. Copy config.example.json to config.json and fill it in.`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`config.json is not valid JSON: ${e.message}`);
  }
}

export function loadEnv() {
  return {
    APOLLO_MASTER_KEY: process.env.APOLLO_MASTER_KEY || null,
    GHL_PIT: process.env.GHL_PIT || null,
    GHL_LOCATION_ID: process.env.GHL_LOCATION_ID || null,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const has = (f) => argv.includes(f);
  const val = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
  };
  const live = has('--live');
  return {
    // dry-run is the default; only --live disables it
    dryRun: has('--dry-run') ? true : !live,
    source: val('--source', 'apollo'),
    csvPath: val('--csv', undefined),
    limit: val('--limit') ? Number(val('--limit')) : undefined,
  };
}
