'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateBatchForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await fetch(`/api/clients/${clientId}/batches`, { method: 'POST' });
        setBusy(false);
        if (!r.ok) {
          setErr((await r.json().catch(() => ({})))?.error || 'failed');
          return;
        }
        const data = await r.json();
        router.push(`/clients/${clientId}/batches/${data.batch_id}`);
      }}
    >
      <button className="btn-primary" disabled={busy}>
        {busy ? '…' : 'New batch'}
      </button>
      {err && <span className="text-bad text-xs self-center">{err}</span>}
    </form>
  );
}
