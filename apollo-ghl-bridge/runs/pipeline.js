// Shared orchestration for both dry-run and live sync.
//
// source -> normalize -> dedupe -> ICP verify -> (dry: log only) | (live: upsert + tag)
// Every decision is logged; dry-run makes zero writes.

import { loadConfig, loadEnv } from '../lib/config.js';
import { createLog } from '../lib/logger.js';
import { dedupe } from '../lib/dedupe.js';
import { evaluate } from '../scoring/icp_rules.js';
import * as apolloListSource from '../sources/apollo_list_source.js';
import * as csvSource from '../sources/csv_source.js';
import {
  buildUpsertBody,
  buildCustomFields,
  upsertContact,
} from '../destinations/ghl_contacts.js';
import { addTags } from '../destinations/ghl_tags.js';

async function loadFromSource(source, { config, env, csvPath }) {
  if (source === 'csv') {
    return csvSource.fetch({
      path: csvPath || config.csv?.path,
      mapping: config.csv?.mapping || {},
    });
  }
  if (source === 'apollo') {
    return apolloListSource.fetch({
      apiKey: env.APOLLO_MASTER_KEY,
      listName: config.apollo?.listName,
      perPage: config.apollo?.perPage ?? 100,
      maxPages: config.apollo?.maxPages ?? 500,
    });
  }
  throw new Error(`Unknown source "${source}". Use --source apollo|csv.`);
}

export async function run({ dryRun = true, source = 'apollo', csvPath, limit } = {}) {
  const config = await loadConfig();
  const env = loadEnv();
  const log = createLog({ dryRun, source });

  const locationId = env.GHL_LOCATION_ID || config.ghl?.locationId;
  const tags = config.ghl?.tags || [];
  const useSeparateTagCall = !!config.ghl?.useSeparateTagCall;

  // Pre-flight validation for live runs (fail fast, before any writes).
  if (!dryRun) {
    const missing = [];
    if (!env.GHL_PIT) missing.push('GHL_PIT (.env)');
    if (!locationId || String(locationId).startsWith('PUT_'))
      missing.push('GHL_LOCATION_ID (.env) or ghl.locationId (config.json)');
    if (source === 'apollo' && !env.APOLLO_MASTER_KEY) missing.push('APOLLO_MASTER_KEY (.env)');
    if (missing.length) {
      throw new Error(`Live sync blocked — missing: ${missing.join(', ')}`);
    }
  }

  console.log(
    `\n=== Apollo→GHL bridge | mode=${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'} | source=${source} ===\n`,
  );

  // 1. Pull
  let contacts = await loadFromSource(source, { config, env, csvPath });
  console.log(`Pulled ${contacts.length} record(s) from ${source}.`);

  // 2. Dedupe (email -> domain) within the pulled set
  const { unique, duplicates } = dedupe(contacts);
  for (const d of duplicates) {
    log.decision('skip', d.contact, { reason: 'duplicate', key: d.key });
  }

  // 3. Optional limit (handy for small test runs)
  let working = unique;
  if (limit && limit > 0) working = working.slice(0, limit);
  console.log(`${working.length} unique record(s) after dedupe${limit ? ` (limited to ${limit})` : ''}.\n`);

  // 4. Per-record ICP verify + write decision
  for (const contact of working) {
    const verdict = evaluate(contact, config.icp || {});
    if (!verdict.qualified) {
      log.decision('skip', contact, {
        reason: 'icp_fail',
        reasons: verdict.reasons,
        score: verdict.score,
      });
      continue;
    }

    const customFields = buildCustomFields(
      contact,
      { score: verdict.score, reasons: verdict.reasons },
      config.ghl?.customFields || [],
    );
    const body = buildUpsertBody(contact, { locationId, tags, customFields });

    if (dryRun) {
      log.decision('upsert', contact, {
        dryRun: true,
        score: verdict.score,
        reasons: verdict.reasons,
        tags,
        body,
      });
      log.decision('tag', contact, { dryRun: true, tags, via: 'upsert_body' });
      continue;
    }

    // LIVE
    try {
      const res = await upsertContact(env.GHL_PIT, body);
      log.decision(res.action === 'upsert' ? 'upsert' : res.action, contact, {
        contactId: res.id,
        score: verdict.score,
        reasons: verdict.reasons,
      });

      if (useSeparateTagCall && res.id && tags.length) {
        await addTags(env.GHL_PIT, res.id, tags);
        log.decision('tag', contact, { contactId: res.id, tags, via: 'tags_endpoint' });
      } else {
        log.decision('tag', contact, { contactId: res.id, tags, via: 'upsert_body' });
      }
    } catch (e) {
      log.decision('error', contact, { message: e.message, status: e.status, body: e.body });
    }
  }

  const path = await log.write();
  const summary = log.summary();
  console.log(`\nSummary: ${JSON.stringify(summary.counts)}  (mode: ${dryRun ? 'DRY-RUN' : 'LIVE'})`);
  console.log(`Full decision log: ${path}\n`);
  return summary;
}
