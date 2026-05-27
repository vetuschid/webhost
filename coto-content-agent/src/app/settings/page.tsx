import { connectorReadiness, defaultImageProvider, defaultLlmProvider, activeUser } from '@/utils/env';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const ready = connectorReadiness();
  const user = activeUser();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Defaults</h2>
        <p className="text-xs text-zinc-500">
          These read from <code>.env</code>. Restart the dev server after editing.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Row label="DEFAULT_LLM_PROVIDER" value={defaultLlmProvider()} />
          <Row label="DEFAULT_IMAGE_PROVIDER" value={defaultImageProvider()} />
          <Row label="ACTIVE_USER (role)" value={user.role} />
          <Row label="ACTIVE_USER_NAME" value={user.name} />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Connector readiness</h2>
        <p className="text-xs text-zinc-500">
          Green = env var present. Red = not configured (the feature stub will return a no-op).
        </p>
        <ul className="grid md:grid-cols-2 gap-2 text-sm">
          {Object.entries(ready).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between border border-edge bg-ink/60 rounded px-3 py-2">
              <span className="font-mono text-xs">{k}</span>
              <span className={v ? 'pill-ok' : 'pill-bad'}>{v ? 'ready' : 'stub'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2">Provider choice</h2>
        <p className="text-xs text-zinc-500 mb-3">
          You can override per-batch provider via the manifest's <code>llm_provider</code> and{' '}
          <code>image_provider</code> fields. v1 keeps things explicit so A/B tests with Hermes stay clean.
        </p>
        <ul className="text-xs text-zinc-400 space-y-1">
          <li>llm: openai | anthropic | openrouter</li>
          <li>image: prompt_only | openai_image | higgsfield_stub</li>
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-edge bg-ink/60 rounded px-3 py-2">
      <span className="text-xs text-zinc-400 font-mono">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
