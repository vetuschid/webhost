// Decision logger. Every create/update/upsert/tag/skip/error is recorded and
// printed. On finish, the full run is written to logs/sync_log.json.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const KNOWN = ['create', 'update', 'upsert', 'tag', 'skip', 'error'];

export function createLog({ dryRun, source }) {
  const started = new Date().toISOString();
  const decisions = [];
  const counts = Object.fromEntries(KNOWN.map((k) => [k, 0]));

  function label(contact) {
    if (!contact) return '?';
    return (
      contact.email ||
      contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      contact.company ||
      '?'
    );
  }

  function decision(type, contact, meta = {}) {
    counts[type] = (counts[type] || 0) + 1;
    const entry = {
      ts: new Date().toISOString(),
      type,
      email: contact?.email || null,
      name: contact?.name || [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || null,
      company: contact?.company || null,
      ...meta,
    };
    decisions.push(entry);

    if (process.env.LOG_SILENT === '1') return;
    const mode = dryRun ? 'DRY ' : 'LIVE';
    let extra = '';
    if (meta.reason) extra += ` reason=${meta.reason}`;
    if (meta.reasons?.length) extra += ` [${meta.reasons.join(',')}]`;
    if (meta.score !== undefined) extra += ` score=${meta.score}`;
    if (meta.contactId) extra += ` id=${meta.contactId}`;
    if (meta.message) extra += ` err="${meta.message}"`;
    console.log(`[${mode}] ${type.toUpperCase().padEnd(6)} ${label(contact)}${extra}`);
  }

  function summary() {
    return {
      started,
      finished: new Date().toISOString(),
      dryRun,
      source,
      counts,
      total: decisions.length,
    };
  }

  async function write() {
    const dir = path.resolve('logs');
    await mkdir(dir, { recursive: true });
    const payload = { ...summary(), decisions };
    await writeFile(path.join(dir, 'sync_log.json'), JSON.stringify(payload, null, 2));
    return path.join(dir, 'sync_log.json');
  }

  return { decision, summary, write, decisions };
}
