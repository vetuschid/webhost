import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiKeyOut } from '@/lib/types';

const PROVIDERS: { id: string; label: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI API key', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic API key', placeholder: 'sk-ant-...' },
  { id: 'apollo', label: 'Apollo master API key', placeholder: 'apollo master key' },
  { id: 'ghl_pit', label: 'GoHighLevel Private Integration Token', placeholder: 'pit-...' },
  { id: 'ghl_location_id', label: 'GoHighLevel Location ID', placeholder: 'loc_xyz' },
];

export default function Setup() {
  const qc = useQueryClient();
  const { data: keys = [] } = useQuery<ApiKeyOut[]>({
    queryKey: ['keys'],
    queryFn: api.listKeys,
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Setup</h1>
      <p className="text-slate-400 text-sm mb-6">
        Keys are encrypted at rest with Fernet. The master key lives at{' '}
        <code className="bg-slate-800 px-1.5 py-0.5 rounded">~/.lead-sifter/master.key</code> (chmod
        600). Only the last 4 characters are ever shown after save.
      </p>
      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const existing = keys.find((k) => k.provider === p.id);
          return <KeyRow key={p.id} provider={p.id} label={p.label} placeholder={p.placeholder} existing={existing} qc={qc} />;
        })}
      </div>
    </div>
  );
}

function KeyRow({
  provider,
  label,
  placeholder,
  existing,
  qc,
}: {
  provider: string;
  label: string;
  placeholder: string;
  existing?: ApiKeyOut;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [value, setValue] = useState('');
  const [test, setTest] = useState<{ ok: boolean; detail: string | null } | null>(null);

  const save = useMutation({
    mutationFn: () => api.saveKey(provider, value),
    onSuccess: () => {
      setValue('');
      qc.invalidateQueries({ queryKey: ['keys'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteKey(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keys'] }),
  });
  const runTest = useMutation({
    mutationFn: () => api.testKey(provider),
    onSuccess: (d) => setTest(d),
  });

  return (
    <div className="border border-slate-800 rounded-lg p-4 flex flex-col gap-3 bg-slate-900/40">
      <div className="flex items-center justify-between">
        <div className="font-medium">{label}</div>
        {existing && (
          <span className="text-xs text-slate-400">
            saved · ends in <code className="text-emerald-400">{existing.last4}</code>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={existing ? 'enter new value to replace' : placeholder}
          className="flex-1"
        />
        <button
          onClick={() => save.mutate()}
          disabled={!value || save.isPending}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm"
        >
          Save
        </button>
        <button
          onClick={() => runTest.mutate()}
          disabled={!existing || runTest.isPending}
          className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-sm"
        >
          Test
        </button>
        {existing && (
          <button
            onClick={() => remove.mutate()}
            className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 text-white text-sm"
          >
            Delete
          </button>
        )}
      </div>
      {(test || save.error || remove.error) && (
        <div className="text-xs">
          {test && (
            <span className={test.ok ? 'text-emerald-400' : 'text-rose-400'}>
              {test.ok ? '✓ ok' : '✗ '}
              {test.detail}
            </span>
          )}
          {save.error && <div className="text-rose-400">{String(save.error)}</div>}
          {remove.error && <div className="text-rose-400">{String(remove.error)}</div>}
        </div>
      )}
    </div>
  );
}
