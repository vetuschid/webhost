import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, dedupeKey } from '../lib/dedupe.js';

test('dedupeKey prefers email, then domain, then name', () => {
  assert.equal(dedupeKey({ email: 'A@B.com', domain: 'b.com' }), 'email:a@b.com');
  assert.equal(dedupeKey({ domain: 'B.com' }), 'domain:b.com');
  assert.equal(dedupeKey({ name: 'Jane Doe' }), 'name:jane doe');
  assert.equal(dedupeKey({}), null);
});

test('dedupe collapses duplicate emails, keeps distinct', () => {
  const { unique, duplicates } = dedupe([
    { email: 'jane@x.com' },
    { email: 'JANE@x.com' },
    { email: 'bob@y.com' },
  ]);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 1);
});

test('dedupe falls back to domain only when email missing', () => {
  const { unique, duplicates } = dedupe([
    { domain: 'acme.com' },
    { domain: 'acme.com' },
    { email: 'real@acme.com' },
  ]);
  // two domain-only records collapse; the email one is distinct
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 1);
});
