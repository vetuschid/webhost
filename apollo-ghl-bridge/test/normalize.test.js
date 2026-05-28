import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApolloContact,
  normalizeCsvRow,
  domainFromEmail,
} from '../lib/normalize.js';

test('domainFromEmail extracts and lowercases', () => {
  assert.equal(domainFromEmail('Jane@Acme.IO'), 'acme.io');
  assert.equal(domainFromEmail('nope'), null);
});

test('normalizeApolloContact maps nested org + phone', () => {
  const c = normalizeApolloContact({
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'JANE@acme.io',
    title: 'VP RevOps',
    phone_numbers: [{ sanitized_number: '+15551112222' }],
    organization: { name: 'Acme', primary_domain: 'acme.io' },
    city: 'Boston',
    country: 'United States',
  });
  assert.equal(c.email, 'jane@acme.io');
  assert.equal(c.company, 'Acme');
  assert.equal(c.domain, 'acme.io');
  assert.equal(c.phone, '+15551112222');
  assert.equal(c.source, 'apollo_list');
});

test('normalizeCsvRow honors mapping and derives domain from email', () => {
  const c = normalizeCsvRow(
    { 'Work Email': 'bob@floralsoft.com', 'Job Title': 'Marketing Manager', Company: 'FloralSoft' },
    { email: 'Work Email', title: 'Job Title', company: 'Company' },
  );
  assert.equal(c.email, 'bob@floralsoft.com');
  assert.equal(c.title, 'Marketing Manager');
  assert.equal(c.domain, 'floralsoft.com');
  assert.equal(c.source, 'csv');
});
