// GoHighLevel V2 dedicated add-tags endpoint.
//
// Tags can ride along in the /contacts/upsert body (GHL auto-creates unknown
// tags), which is the default path. This module is the alternative: add tags
// to an existing contact id in a separate call. Enable via
// config.ghl.useSeparateTagCall = true.

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

export async function addTags(pit, contactId, tags = []) {
  if (!contactId) throw new Error('addTags requires a contactId');
  if (!tags.length) return { tagsAdded: [] };
  return request(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: headers(pit),
    body: { tags },
  });
}
