// Live, READ-ONLY preflight against real Apollo + GoHighLevel APIs.
// Use this the moment you paste keys into .env, BEFORE any sync.
//
//   node scripts/preflight.js
//
// What it does:
//   1. GET  /api/v1/labels                  -> proves APOLLO_MASTER_KEY is a master key
//      -> finds your configured listName, reports its id and an example contact count
//   2. POST /api/v1/contacts/search (page 1, per_page=1) -> proves the list pull works
//   3. GET  /locations/{id}                 -> proves GHL_PIT + GHL_LOCATION_ID + Version header
//
// No writes. Safe to run anytime.

import 'dotenv/config';
import { loadConfig, loadEnv } from '../lib/config.js';
import { request } from '../lib/http.js';
import { listLabels, findListIdByName, fetchListContacts } from '../sources/apollo_list_source.js';

const GHL_BASE = (process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com').replace(/\/$/, '');
const GHL_VERSION = '2021-07-28';

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

async function checkApollo(env, config) {
  console.log('\n— Apollo —');
  if (!env.APOLLO_MASTER_KEY) {
    fail('APOLLO_MASTER_KEY not set in .env');
    return false;
  }
  try {
    const labels = await listLabels(env.APOLLO_MASTER_KEY);
    ok(`GET /labels worked (${labels.length} list(s) on this account)`);
    if (!config.apollo?.listName) {
      fail('config.json apollo.listName not set; skipping list lookup');
      return false;
    }
    const id = await findListIdByName(env.APOLLO_MASTER_KEY, config.apollo.listName);
    ok(`list "${config.apollo.listName}" resolved → ${id}`);
    const sample = await fetchListContacts(env.APOLLO_MASTER_KEY, id, {
      perPage: 1,
      maxPages: 1,
    });
    ok(`/contacts/search page 1 returned ${sample.length} contact(s) (full list may be larger)`);
    return true;
  } catch (e) {
    fail(e.message);
    if (e.status === 403) {
      console.log(
        "    Hint: 403 from /labels usually means the key isn't a MASTER key. " +
          'In Apollo: Settings → Integrations → API → "Master API key".',
      );
    }
    return false;
  }
}

async function checkGhl(env, config) {
  console.log('\n— GoHighLevel —');
  const locationId = env.GHL_LOCATION_ID || config.ghl?.locationId;
  if (!env.GHL_PIT) {
    fail('GHL_PIT not set in .env');
    return false;
  }
  if (!locationId || String(locationId).startsWith('PUT_')) {
    fail('GHL_LOCATION_ID not set (in .env or config.json)');
    return false;
  }
  try {
    const data = await request(`${GHL_BASE}/locations/${locationId}`, {
      headers: {
        Authorization: `Bearer ${env.GHL_PIT}`,
        Version: GHL_VERSION,
        Accept: 'application/json',
      },
    });
    const loc = data.location || data;
    ok(
      `GET /locations/${locationId} worked (location: "${loc.name || loc.companyName || '?'}")`,
    );
    // Surface custom field placeholders so the user fixes them before going live.
    const cf = config.ghl?.customFields || [];
    const placeholders = cf.filter((f) => String(f.id || '').startsWith('REPLACE_WITH'));
    if (placeholders.length) {
      fail(
        `${placeholders.length} custom field(s) in config.json still have REPLACE_WITH_… IDs — ` +
          'they will be silently skipped on sync. Paste real GHL field IDs.',
      );
    } else if (cf.length) {
      ok(`${cf.length} custom field mapping(s) configured`);
    }
    return true;
  } catch (e) {
    fail(e.message);
    if (e.status === 401) {
      console.log(
        '    Hint: 401 usually means the PIT or Version header is wrong. ' +
          'Settings → Private Integrations; scope it for Contacts View+Edit.',
      );
    }
    return false;
  }
}

const config = await loadConfig().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
const env = loadEnv();

console.log('Apollo → GHL bridge: preflight (read-only)');

const a = await checkApollo(env, config);
const g = await checkGhl(env, config);

if (!a || !g) {
  console.log('\nPreflight FAILED — fix the issues above before running --live.');
  process.exit(1);
}
console.log('\nPreflight OK — safe to run dry-run, then --live.');
