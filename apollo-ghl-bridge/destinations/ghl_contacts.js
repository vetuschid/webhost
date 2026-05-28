// GoHighLevel V2 contacts upsert.
//
// - Base: https://services.leadconnectorhq.com  (V1 is EOL — V2 only)
// - Every request needs BOTH headers: Authorization: Bearer <PIT>  and
//   Version: 2021-07-28
// - POST /contacts/upsert is create-or-update. It does NOT take a matching key;
//   GHL identifies an existing contact by email and/or phone per the
//   location-level "Allow Duplicate Contact" setting. Configure that in GHL,
//   not here.
// - Contact custom fields must be PRE-CREATED in the GHL UI (the v2 Custom
//   Fields API does not support creating Contact fields). We only write values
//   to known field IDs.

import { request } from '../lib/http.js';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

function headers(pit) {
  return {
    Authorization: `Bearer ${pit}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// Resolve a configured custom-field entry into { id, value } for the upsert body.
//   { id, value }          -> static value
//   { id, from: "score" }  -> contact-derived: "score" | "reasons" | any contact field
export function buildCustomFields(contact, { score, reasons }, customFieldConfig = []) {
  return customFieldConfig
    .map((f) => {
      if (!f.id || f.id.startsWith('REPLACE_WITH')) return null; // skip unconfigured placeholders
      let value = f.value;
      if (f.from) {
        if (f.from === 'score') value = String(score);
        else if (f.from === 'reasons') value = (reasons || []).join(', ');
        else value = contact[f.from] ?? '';
      }
      if (value === undefined || value === null || value === '') return null;
      return { id: f.id, value: String(value) };
    })
    .filter(Boolean);
}

export function buildUpsertBody(contact, { locationId, tags = [], customFields = [] }) {
  const body = { locationId };
  if (contact.firstName) body.firstName = contact.firstName;
  if (contact.lastName) body.lastName = contact.lastName;
  if (!contact.firstName && !contact.lastName && contact.name) body.name = contact.name;
  if (contact.email) body.email = contact.email;
  if (contact.phone) body.phone = contact.phone;
  if (contact.company) body.companyName = contact.company;
  if (contact.website || contact.domain) {
    body.website = contact.website || `https://${contact.domain}`;
  }
  if (contact.city) body.city = contact.city;
  if (contact.state) body.state = contact.state;
  if (contact.country) body.country = contact.country;
  if (tags.length) body.tags = tags;
  if (customFields.length) body.customFields = customFields;
  return body;
}

export async function upsertContact(pit, body) {
  const data = await request(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: headers(pit),
    body,
  });
  const contact = data.contact || data;
  // GHL returns `new: true` when it created the record (when present).
  let action = 'upsert';
  if (data.new === true) action = 'create';
  else if (data.new === false) action = 'update';
  return { id: contact?.id || null, action, raw: data };
}
