// End-to-end integration tests that drive the REAL pipeline against local
// HTTP mocks impersonating Apollo + GoHighLevel V2. These tests cover the
// surface area that pure unit tests can't: header casing, pagination,
// the "new: true/false" -> action mapping, custom-field placeholder
// skipping, the separate-tag-call branch, 429 retry behavior, and the
// preflight guard for missing keys.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Silence pipeline + logger output while tests run.
process.env.LOG_SILENT = '1';

import { startMockApollo, startMockGhl } from './mock_server.js';

let apollo, ghl, prevCwd, tmpDir;
let run;

before(async () => {
  apollo = await startMockApollo();
  ghl = await startMockGhl();
  // Point the bridge at the mocks before importing the pipeline (env is read at module init).
  process.env.APOLLO_BASE_URL = apollo.url;
  process.env.GHL_BASE_URL = ghl.url;
  // Run inside a temp cwd so logs/sync_log.json doesn't pollute the repo.
  tmpDir = await mkdtemp(path.join(tmpdir(), 'bridge-itest-'));
  prevCwd = process.cwd();
  process.chdir(tmpDir);
  ({ run } = await import('../../runs/pipeline.js'));
});

after(async () => {
  process.chdir(prevCwd);
  await rm(tmpDir, { recursive: true, force: true });
  await apollo.stop();
  await ghl.stop();
});

beforeEach(() => {
  apollo.reset();
  ghl.reset();
});

const baseConfig = () => ({
  apollo: { listName: 'VIP Intent ICP', perPage: 100, maxPages: 500 },
  icp: {
    requireFields: ['email'],
    titleIncludesAny: ['revops', 'revenue operations', 'chief revenue'],
    titleExcludesAny: ['intern'],
    allowedCountries: ['United States', 'Canada'],
    excludeDomains: ['gong.io'],
    weights: { title: 4, country: 1 },
  },
  ghl: {
    locationId: 'loc_test',
    tags: ['VIP_INTENT_ICP_TEST', 'APOLLO_IMPORTED_TEST'],
    useSeparateTagCall: false,
    customFields: [
      { id: 'cf_source', value: 'Apollo List Import' },
      { id: 'cf_score', from: 'score' },
      { id: 'cf_reason', from: 'reasons' },
      { id: 'REPLACE_WITH_GHL_FIELD_ID_skip_me', from: 'score' },
    ],
  },
});

const baseEnv = () => ({
  APOLLO_MASTER_KEY: 'apollo-test-key',
  GHL_PIT: 'ghl-test-pit',
  GHL_LOCATION_ID: 'loc_test',
});

const apolloContact = (over = {}) => ({
  id: 'a_' + Math.random().toString(36).slice(2, 8),
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@acme.io',
  title: 'VP Revenue Operations',
  phone_numbers: [{ sanitized_number: '+15551112222' }],
  organization: { name: 'Acme', primary_domain: 'acme.io' },
  city: 'Boston',
  state: 'MA',
  country: 'United States',
  ...over,
});

// ----------------------------------------------------------------------------

test('Apollo: resolves list name → id via GET /labels with x-api-key', async () => {
  apollo.setBehavior({
    labels: [
      { id: 'lab_other', name: 'Other List' },
      { id: 'lab_vip', name: 'VIP Intent ICP' },
    ],
    contactsByList: { lab_vip: [apolloContact()] },
  });

  await run({
    dryRun: true,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });

  const labelsReq = apollo.requests.find((r) => r.path === '/api/v1/labels');
  assert.ok(labelsReq, 'must call GET /api/v1/labels');
  assert.equal(labelsReq.method, 'GET');
  assert.equal(labelsReq.headers['x-api-key'], 'apollo-test-key');

  const searchReq = apollo.requests.find((r) => r.path === '/api/v1/contacts/search');
  assert.ok(searchReq, 'must call POST /api/v1/contacts/search');
  assert.equal(searchReq.method, 'POST');
  assert.deepEqual(searchReq.body.contact_label_ids, ['lab_vip']);
  assert.equal(searchReq.body.page, 1);
});

test('Apollo: paginates /contacts/search until the last page', async () => {
  const many = Array.from({ length: 7 }, (_, i) =>
    apolloContact({ id: `a${i}`, email: `p${i}@acme.io` }),
  );
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: many },
  });

  const cfg = baseConfig();
  cfg.apollo.perPage = 3; // forces 3 pages: 3 + 3 + 1
  const summary = await run({ dryRun: true, source: 'apollo', configOverride: cfg, envOverride: baseEnv() });

  const searches = apollo.requests.filter((r) => r.path === '/api/v1/contacts/search');
  assert.equal(searches.length, 3, 'should stop after the short last page');
  assert.deepEqual(
    searches.map((s) => s.body.page),
    [1, 2, 3],
  );
  // 7 unique inputs, all qualify (RevOps + US) → 7 dry-run upserts.
  assert.equal(summary.counts.upsert, 7);
});

test('Apollo: 401 on /labels surfaces a clear error (master-key check)', async () => {
  apollo.setBehavior({ statusForPath: { '/api/v1/labels': 401 } });
  await assert.rejects(
    () => run({ dryRun: true, source: 'apollo', configOverride: baseConfig(), envOverride: baseEnv() }),
    /HTTP 401/,
  );
});

test('Apollo: 429 on /labels triggers retry and eventually succeeds', async () => {
  apollo.setBehavior({
    retryOnce: true,
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });
  const summary = await run({
    dryRun: true,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });
  assert.equal(summary.counts.upsert, 1);
  const labelsCalls = apollo.requests.filter((r) => r.path === '/api/v1/labels').length;
  assert.ok(labelsCalls >= 2, 'should have retried after 429');
});

// ----------------------------------------------------------------------------

test('GHL: live upsert sends Bearer + Version: 2021-07-28 + locationId + tags + customFields', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });

  const summary = await run({
    dryRun: false,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });

  const upsert = ghl.requests.find((r) => r.path === '/contacts/upsert');
  assert.ok(upsert, 'must POST /contacts/upsert');
  assert.equal(upsert.headers['authorization'], 'Bearer ghl-test-pit');
  assert.equal(upsert.headers['version'], '2021-07-28');
  assert.equal(upsert.headers['content-type'], 'application/json');
  assert.equal(upsert.body.locationId, 'loc_test');
  assert.equal(upsert.body.email, 'jane@acme.io');
  assert.equal(upsert.body.firstName, 'Jane');
  assert.equal(upsert.body.companyName, 'Acme');
  assert.deepEqual(upsert.body.tags, ['VIP_INTENT_ICP_TEST', 'APOLLO_IMPORTED_TEST']);

  // Placeholder customField IDs are skipped; real ones are written.
  const cfIds = upsert.body.customFields.map((c) => c.id);
  assert.deepEqual(cfIds.sort(), ['cf_reason', 'cf_score', 'cf_source']);
  const score = upsert.body.customFields.find((c) => c.id === 'cf_score');
  assert.ok(Number(score.value) >= 1, 'cf_score should hold the ICP score');

  assert.equal(summary.counts.create, 1, 'GHL "new: true" should map to create');
});

test('GHL: "new: false" upsert response maps to action=update', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });
  ghl.setBehavior({
    upsertResponses: [{ contact: { id: 'ghl_existing_1' }, new: false }],
  });

  const summary = await run({
    dryRun: false,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });
  assert.equal(summary.counts.update, 1);
  assert.equal(summary.counts.create, 0);
});

test('GHL: useSeparateTagCall=true triggers POST /contacts/{id}/tags', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });
  const cfg = baseConfig();
  cfg.ghl.useSeparateTagCall = true;

  await run({ dryRun: false, source: 'apollo', configOverride: cfg, envOverride: baseEnv() });

  const tagCall = ghl.requests.find((r) => /^\/contacts\/[^/]+\/tags$/.test(r.path));
  assert.ok(tagCall, 'should make a dedicated tags call');
  assert.equal(tagCall.headers['version'], '2021-07-28');
  assert.deepEqual(tagCall.body.tags, ['VIP_INTENT_ICP_TEST', 'APOLLO_IMPORTED_TEST']);
});

test('GHL: 5xx upsert is retried then logged as error if it keeps failing', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });
  ghl.setBehavior({ statusForPath: { '/contacts/upsert': 500 } });

  const summary = await run({
    dryRun: false,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });
  assert.equal(summary.counts.error, 1);
  assert.equal(summary.counts.create, 0);
  // 4 retries (per lib/http.js) -> at least 5 attempts total.
  const upsertCount = ghl.requests.filter((r) => r.path === '/contacts/upsert').length;
  assert.ok(upsertCount >= 5, `expected backoff to retry; got ${upsertCount} attempts`);
});

// ----------------------------------------------------------------------------

test('Preflight: live sync without GHL_PIT throws before any HTTP call', async () => {
  await assert.rejects(
    () =>
      run({
        dryRun: false,
        source: 'apollo',
        configOverride: baseConfig(),
        envOverride: { APOLLO_MASTER_KEY: 'apollo-test-key', GHL_PIT: null, GHL_LOCATION_ID: 'loc_test' },
      }),
    /Live sync blocked.*GHL_PIT/,
  );
  assert.equal(apollo.requests.length, 0, 'must not call Apollo without preflight passing');
  assert.equal(ghl.requests.length, 0, 'must not call GHL without preflight passing');
});

test('Preflight: dry-run never calls GHL even when keys are present', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: { lab_vip: [apolloContact()] },
  });
  await run({
    dryRun: true,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });
  assert.equal(ghl.requests.length, 0, 'dry-run must make zero GHL writes');
});

// ----------------------------------------------------------------------------

test('End-to-end: 4 contacts → 1 competitor + 1 intern skipped → 2 GHL upserts', async () => {
  apollo.setBehavior({
    labels: [{ id: 'lab_vip', name: 'VIP Intent ICP' }],
    contactsByList: {
      lab_vip: [
        apolloContact({ id: 'a1', email: 'jane@acme.io' }), // qualifies
        apolloContact({
          id: 'a2',
          email: 'dan@gong.io',
          organization: { name: 'Gong', primary_domain: 'gong.io' },
        }), // competitor
        apolloContact({
          id: 'a3',
          email: 'eva@klinikai.de',
          title: 'Sales Ops Intern',
        }), // excluded title
        apolloContact({
          id: 'a4',
          email: 'frank@scaleups.io',
          title: 'Chief Revenue Officer',
          organization: { name: 'ScaleUps', primary_domain: 'scaleups.io' },
        }), // qualifies
      ],
    },
  });

  const summary = await run({
    dryRun: false,
    source: 'apollo',
    configOverride: baseConfig(),
    envOverride: baseEnv(),
  });

  assert.equal(summary.counts.create, 2, '2 GHL writes');
  assert.equal(summary.counts.skip, 2, '2 ICP rejections');
  assert.equal(summary.counts.error, 0);
  const upsertEmails = ghl.requests
    .filter((r) => r.path === '/contacts/upsert')
    .map((r) => r.body.email)
    .sort();
  assert.deepEqual(upsertEmails, ['frank@scaleups.io', 'jane@acme.io']);
});
