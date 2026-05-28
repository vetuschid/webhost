// CSV fallback source — for when you export the Apollo List to CSV manually,
// or for offline testing without API keys.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { normalizeCsvRow } from '../lib/normalize.js';

// Adapter contract: fetch(opts) -> canonical contact[]
export async function fetch({ path: csvPath, mapping = {} }) {
  if (!csvPath) throw new Error('CSV source requires a path (--csv <file> or config.csv.path)');
  const abs = path.resolve(csvPath);
  let text;
  try {
    text = await readFile(abs, 'utf8');
  } catch (e) {
    throw new Error(`Could not read CSV at ${abs}: ${e.message}`);
  }
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  return rows.map((r) => normalizeCsvRow(r, mapping));
}
