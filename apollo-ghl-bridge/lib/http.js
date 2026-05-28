// Thin fetch wrapper with JSON handling and 429/5xx exponential backoff.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function request(url, { method = 'GET', headers = {}, body, retries = 4 } = {}) {
  let delay = 1000;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // network error — retry
      lastErr = e;
      await sleep(delay);
      delay *= 2;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      await sleep(wait);
      delay *= 2;
      lastErr = new Error(`HTTP ${res.status} on ${method} ${url}`);
      continue;
    }

    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    if (!res.ok) {
      const detail = typeof json === 'string' ? json : JSON.stringify(json);
      const err = new Error(`HTTP ${res.status} ${method} ${url}: ${detail}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }
  throw lastErr || new Error(`Exhausted retries for ${method} ${url}`);
}
