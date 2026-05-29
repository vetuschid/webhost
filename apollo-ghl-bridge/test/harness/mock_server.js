// Tiny local HTTP mock servers that impersonate Apollo + GoHighLevel V2.
//
// Records every request (method, url, headers, body) for assertion. Returns
// realistic response shapes. Used by test/harness/integration.test.js to drive
// the real pipeline.js end-to-end without touching real APIs.
//
// Each server is configurable per-test via `setBehavior({...})`:
//   - apollo: { labels, contactsByList, status, retryOnce, perPage, totalPages }
//   - ghl:    { upsertResponse, status, retryOnce, tagsResponse }

import { createServer } from 'node:http';

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      if (!buf) return resolve(null);
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body == null ? '' : JSON.stringify(body));
}

export async function startMockApollo() {
  const requests = [];
  const initialBehavior = () => ({
    labels: [{ id: 'lab_1', name: 'VIP Intent ICP' }],
    contactsByList: { lab_1: [] },
    perPage: 100,
    statusForPath: {}, // { '/api/v1/labels': 401 }
    retryOnce: false, // first call 429, subsequent OK
    retryCount: 0,
  });
  let behavior = initialBehavior();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    let body = null;
    if (req.method === 'POST') {
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: 'bad json' });
      }
    }
    requests.push({
      method: req.method,
      path,
      headers: { ...req.headers },
      body,
    });

    // Forced status (for auth/error tests)
    const forced = behavior.statusForPath[path];
    if (forced) {
      return send(res, forced, { error: { code: forced, message: `forced ${forced}` } });
    }

    // 429 then OK (backoff test)
    if (behavior.retryOnce && behavior.retryCount === 0) {
      behavior.retryCount += 1;
      return send(res, 429, { error: 'rate limited' }, { 'Retry-After': '0' });
    }

    if (req.method === 'GET' && path === '/api/v1/labels') {
      return send(res, 200, { labels: behavior.labels });
    }

    if (req.method === 'POST' && path === '/api/v1/contacts/search') {
      const listId = body?.contact_label_ids?.[0];
      const page = Number(body?.page || 1);
      const perPage = Number(body?.per_page || behavior.perPage);
      const all = behavior.contactsByList[listId] || [];
      const start = (page - 1) * perPage;
      const slice = all.slice(start, start + perPage);
      const totalPages = Math.max(1, Math.ceil(all.length / perPage));
      return send(res, 200, {
        contacts: slice,
        pagination: { page, per_page: perPage, total_entries: all.length, total_pages: totalPages },
      });
    }

    return send(res, 404, { error: 'not found' });
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    requests,
    setBehavior(patch) {
      behavior = { ...behavior, ...patch, statusForPath: { ...behavior.statusForPath, ...(patch.statusForPath || {}) } };
      if (patch.retryOnce === false) behavior.retryCount = 0;
    },
    reset() {
      requests.length = 0;
      behavior = initialBehavior();
    },
    async stop() {
      await new Promise((r) => server.close(r));
    },
  };
}

export async function startMockGhl() {
  const requests = [];
  const initialBehavior = () => ({
    upsertResponses: [], // queue of responses; falls back to default if empty
    defaultUpsert: { contact: { id: 'ghl_new_1' }, new: true },
    tagsResponse: { tagsAdded: ['VIP_INTENT_ICP_TEST'] },
    statusForPath: {},
    retryOnce: false,
    retryCount: 0,
  });
  let behavior = initialBehavior();
  let upsertCalls = 0;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    let body = null;
    if (req.method === 'POST') {
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: 'bad json' });
      }
    }
    requests.push({
      method: req.method,
      path,
      headers: { ...req.headers },
      body,
    });

    const forced = behavior.statusForPath[path];
    if (forced) {
      return send(res, forced, { error: { statusCode: forced, message: `forced ${forced}` } });
    }

    if (behavior.retryOnce && behavior.retryCount === 0) {
      behavior.retryCount += 1;
      return send(res, 429, { error: 'rate limited' }, { 'Retry-After': '0' });
    }

    if (req.method === 'POST' && path === '/contacts/upsert') {
      const idx = upsertCalls++;
      const r = behavior.upsertResponses[idx] || behavior.defaultUpsert;
      return send(res, 200, r);
    }

    const tagMatch = path.match(/^\/contacts\/([^/]+)\/tags$/);
    if (req.method === 'POST' && tagMatch) {
      return send(res, 200, behavior.tagsResponse);
    }

    return send(res, 404, { error: 'not found' });
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    requests,
    setBehavior(patch) {
      behavior = { ...behavior, ...patch, statusForPath: { ...behavior.statusForPath, ...(patch.statusForPath || {}) } };
      if (patch.upsertResponses) upsertCalls = 0;
      if (patch.retryOnce === false) behavior.retryCount = 0;
    },
    reset() {
      requests.length = 0;
      upsertCalls = 0;
      behavior = initialBehavior();
    },
    async stop() {
      await new Promise((r) => server.close(r));
    },
  };
}
