import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUpsertBody, buildCustomFields } from '../destinations/ghl_contacts.js';

test('buildUpsertBody includes locationId, mapped fields, tags', () => {
  const body = buildUpsertBody(
    {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.io',
      phone: '+15551112222',
      company: 'Acme',
      domain: 'acme.io',
      city: 'Boston',
      state: 'MA',
      country: 'United States',
    },
    { locationId: 'loc123', tags: ['VIP_INTENT_ICP_TEST'], customFields: [] },
  );
  assert.equal(body.locationId, 'loc123');
  assert.equal(body.email, 'jane@acme.io');
  assert.equal(body.companyName, 'Acme');
  assert.equal(body.website, 'https://acme.io');
  assert.deepEqual(body.tags, ['VIP_INTENT_ICP_TEST']);
});

test('buildCustomFields resolves static and derived values, skips placeholders', () => {
  const fields = buildCustomFields(
    { title: 'VP RevOps' },
    { score: 7, reasons: ['title_match', 'country_ok'] },
    [
      { id: 'cf_source', value: 'Apollo List Import' },
      { id: 'cf_score', from: 'score' },
      { id: 'cf_reason', from: 'reasons' },
      { id: 'cf_title', from: 'title' },
      { id: 'REPLACE_WITH_GHL_FIELD_ID_x', from: 'score' },
    ],
  );
  assert.deepEqual(fields, [
    { id: 'cf_source', value: 'Apollo List Import' },
    { id: 'cf_score', value: '7' },
    { id: 'cf_reason', value: 'title_match, country_ok' },
    { id: 'cf_title', value: 'VP RevOps' },
  ]);
});
