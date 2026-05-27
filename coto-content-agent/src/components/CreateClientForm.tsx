'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateClientForm() {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!id.trim()) return;
        setBusy(true);
        setErr(null);
        const r = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: id.trim().toLowerCase() }),
        });
        setBusy(false);
        if (!r.ok) {
          setErr((await r.json().catch(() => ({})))?.error || 'failed');
          return;
        }
        router.refresh();
        setId('');
      }}
    >
      <input
        placeholder="client_id (e.g. lenslock)"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button className="btn-primary" disabled={busy}>
        {busy ? '…' : 'Create'}
      </button>
      {err && <span className="text-bad text-xs self-center">{err}</span>}
    </form>
  );
}
