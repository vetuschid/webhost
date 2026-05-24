import type {
  ApiKeyOut,
  ApolloFilters,
  ChatMessage,
  ChatSession,
  ContextBundleOut,
  GhlTarget,
  LeadOut,
  LeadResultOut,
  Provider,
  RunOut,
} from './types';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!r.ok) {
    let detail: string;
    try {
      const j = await r.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      detail = await r.text();
    }
    throw new Error(`${r.status}: ${detail}`);
  }
  return r.json();
}

export const api = {
  // keys
  listKeys: () => req<ApiKeyOut[]>('/keys'),
  saveKey: (provider: string, value: string) =>
    req<ApiKeyOut>('/keys', {
      method: 'PUT',
      body: JSON.stringify({ provider, value }),
    }),
  deleteKey: (provider: string) => req<{ status: string }>(`/keys/${provider}`, { method: 'DELETE' }),
  testKey: (provider: string) =>
    req<{ ok: boolean; detail: string | null }>(`/keys/${provider}/test`, { method: 'POST' }),
  listModels: (provider: Provider) => req<{ models: string[] }>(`/keys/models/${provider}`),

  // context bundles
  listBundles: () => req<ContextBundleOut[]>('/context'),
  getBundle: (id: number) => req<ContextBundleOut>(`/context/${id}`),
  createBundleFromFolder: (name: string, folder_path: string, qualified_field?: string) =>
    req<ContextBundleOut>('/context', {
      method: 'POST',
      body: JSON.stringify({ name, folder_path, qualified_field }),
    }),
  uploadBundleFiles: async (name: string, files: File[], qualified_field?: string) => {
    const fd = new FormData();
    fd.append('name', name);
    if (qualified_field) fd.append('qualified_field', qualified_field);
    files.forEach((f) => fd.append('files', f));
    const r = await fetch(BASE + '/context/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<ContextBundleOut>;
  },
  deleteBundle: (id: number) => req<{ status: string }>(`/context/${id}`, { method: 'DELETE' }),

  // leads
  apolloPreview: (filters: ApolloFilters) =>
    req<{ count: number; sample: unknown[] }>('/leads/apollo/preview', {
      method: 'POST',
      body: JSON.stringify(filters),
    }),
  csvPreview: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(BASE + '/leads/csv/preview', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{
      headers: string[];
      guessed_mapping: Record<string, string>;
      preview: Record<string, unknown>[];
      rows: number;
    }>;
  },
  listLeads: (run_id: number) => req<LeadOut[]>(`/leads?run_id=${run_id}`),

  // runs
  listRuns: () => req<RunOut[]>('/runs'),
  getRun: (id: number) => req<RunOut>(`/runs/${id}`),
  getRunResults: (id: number) => req<LeadResultOut[]>(`/runs/${id}/results`),
  createRun: (body: {
    model: string;
    provider: Provider;
    bundle_id: number;
    max_parallel: number;
    streaming: boolean;
    source: 'apollo' | 'csv';
    apollo?: ApolloFilters;
    ghl_target: GhlTarget;
  }) => req<RunOut>('/runs', { method: 'POST', body: JSON.stringify(body) }),
  createRunFromCsv: async (params: {
    model: string;
    provider: Provider;
    bundle_id: number;
    max_parallel: number;
    streaming: boolean;
    mapping: Record<string, string>;
    ghl_target: GhlTarget;
    file: File;
  }) => {
    const fd = new FormData();
    fd.append('model', params.model);
    fd.append('provider', params.provider);
    fd.append('bundle_id', String(params.bundle_id));
    fd.append('max_parallel', String(params.max_parallel));
    fd.append('streaming', String(params.streaming));
    fd.append('mapping_json', JSON.stringify(params.mapping));
    fd.append('ghl_target_json', JSON.stringify(params.ghl_target));
    fd.append('file', params.file);
    const r = await fetch(BASE + '/runs/csv', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<RunOut>;
  },
  streamRun: (id: number, onMessage: (evt: Record<string, unknown>) => void): EventSource => {
    const es = new EventSource(`${BASE}/runs/${id}/stream`);
    es.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    return es;
  },

  // ghl
  ghlPipelines: () => req<Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }>>('/ghl/pipelines'),
  ghlTags: () => req<Array<{ id?: string; name: string }>>('/ghl/tags'),
  ghlWorkflows: () => req<Array<{ id: string; name: string }>>('/ghl/workflows'),
  ghlToolMap: (refresh = false) =>
    req<{
      upsert_contact: string | null;
      create_opportunity: string | null;
      add_tags: string | null;
      add_to_workflow: string | null;
      raw_tools: string[];
    }>(`/ghl/tool-map${refresh ? '?refresh=true' : ''}`),
  ghlPushSelection: (lead_result_ids: number[], target: GhlTarget) =>
    req<{ results: unknown[] }>('/ghl/push', {
      method: 'POST',
      body: JSON.stringify({ lead_result_ids, ...{ target } }),
    }),

  // chat
  createChat: (body: { model: string; provider: Provider; bundle_id?: number | null; title?: string }) =>
    req<ChatSession>('/chat/sessions', { method: 'POST', body: JSON.stringify(body) }),
  listChats: () => req<ChatSession[]>('/chat/sessions'),
  listChatMessages: (sid: number) => req<ChatMessage[]>(`/chat/sessions/${sid}/messages`),
  // chat streaming uses EventSource
  streamChat: (sid: number, content: string, onMessage: (e: Record<string, unknown>) => void) => {
    // EventSource is GET-only; we POST first to /send via fetch + read body as text stream is not supported
    // Workaround: post to /send, server returns SSE. We open EventSource at /send endpoint using POST-fetch reader.
    // For simplicity we'll use fetch streaming and parse SSE manually.
    const ac = new AbortController();
    fetch(`${BASE}/chat/sessions/${sid}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ content, streaming: true }),
      signal: ac.signal,
    }).then(async (r) => {
      if (!r.body) return;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const ln of lines) {
          if (ln.startsWith('data: ')) {
            try {
              onMessage(JSON.parse(ln.slice(6)));
            } catch {
              /* ignore */
            }
          }
        }
      }
    });
    return ac;
  },
};
