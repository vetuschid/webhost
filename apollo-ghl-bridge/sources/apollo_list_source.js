// Apollo List source — the intent+ICP-qualified source of truth.
//
// Apollo's buying-intent filter is UI / Chrome-extension only; it is NOT
// exposed in the API. The qualification therefore happens in the Apollo UI:
// you build a List of intent+ICP prospects, and this adapter pulls that List.
//
// Flow:
//   1. GET  /api/v1/labels                  -> resolve list name -> list id
//   2. POST /api/v1/contacts/search         -> saved contacts in that list
//      (NOT /mixed_people/search, which hits the net-new DB and returns no emails)
//
// Both endpoints require an Apollo MASTER api key (standard keys 403).

import { request } from '../lib/http.js';
import { normalizeApolloContact } from '../lib/normalize.js';

// Override APOLLO_BASE_URL for tests / mock harness; default = production.
const APOLLO_BASE = (process.env.APOLLO_BASE_URL || 'https://api.apollo.io').replace(/\/$/, '') + '/api/v1';

function headers(apiKey) {
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };
}

export async function listLabels(apiKey) {
  const data = await request(`${APOLLO_BASE}/labels`, { headers: headers(apiKey) });
  if (Array.isArray(data)) return data;
  return data.labels || data.results || [];
}

export async function findListIdByName(apiKey, listName) {
  const labels = await listLabels(apiKey);
  const target = listName.trim().toLowerCase();
  const match = labels.find((l) => (l.name || '').trim().toLowerCase() === target);
  if (!match) {
    const available = labels.map((l) => l.name).filter(Boolean).join(', ') || '(none)';
    throw new Error(`Apollo list "${listName}" not found. Lists on this account: ${available}`);
  }
  return match.id;
}

export async function fetchListContacts(apiKey, listId, { perPage = 100, maxPages = 500 } = {}) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await request(`${APOLLO_BASE}/contacts/search`, {
      method: 'POST',
      headers: headers(apiKey),
      body: { contact_label_ids: [listId], page, per_page: perPage },
    });
    const contacts = data.contacts || data.people || [];
    out.push(...contacts);
    const totalPages = data.pagination?.total_pages ?? 1;
    if (contacts.length < perPage || page >= totalPages) break;
  }
  return out;
}

// Adapter contract: fetch(opts) -> canonical contact[]
export async function fetch({ apiKey, listName, perPage, maxPages }) {
  if (!apiKey) throw new Error('Apollo source requires APOLLO_MASTER_KEY in .env');
  if (!listName) throw new Error('Apollo source requires apollo.listName in config.json');
  const listId = await findListIdByName(apiKey, listName);
  const raw = await fetchListContacts(apiKey, listId, { perPage, maxPages });
  return raw.map(normalizeApolloContact);
}
