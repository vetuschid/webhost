import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../scoring/icp_rules.js';

const RULES = {
  requireFields: ['email'],
  titleIncludesAny: ['revops', 'revenue operations'],
  titleExcludesAny: ['intern'],
  allowedCountries: ['United States', 'Canada'],
  excludeDomains: ['gong.io'],
  weights: { title: 4, country: 1 },
};

test('qualifies a clean RevOps lead and scores it', () => {
  const v = evaluate(
    { email: 'jane@acme.io', title: 'VP Revenue Operations', country: 'United States', domain: 'acme.io' },
    RULES,
  );
  assert.equal(v.qualified, true);
  assert.ok(v.score >= 5);
  assert.ok(v.reasons.includes('title_match'));
  assert.ok(v.reasons.includes('country_ok'));
});

test('disqualifies competitor domain', () => {
  const v = evaluate({ email: 'dan@gong.io', title: 'Director of RevOps', domain: 'gong.io' }, RULES);
  assert.equal(v.qualified, false);
  assert.ok(v.reasons.includes('competitor_domain'));
});

test('disqualifies excluded title', () => {
  const v = evaluate({ email: 'eva@x.io', title: 'Sales Ops Intern', domain: 'x.io' }, RULES);
  assert.equal(v.qualified, false);
  assert.ok(v.reasons.includes('title_excluded'));
});

test('disqualifies missing required field', () => {
  const v = evaluate({ title: 'VP RevOps' }, RULES);
  assert.equal(v.qualified, false);
  assert.ok(v.reasons.includes('missing_email'));
});
