import Link from 'next/link';
import { listClientIds } from '@/lib/clientLoader';
import { listBatches } from '@/lib/batchStore';
import { CreateClientForm } from '@/components/CreateClientForm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const clients = await listClientIds();
  const rows = await Promise.all(
    clients.map(async (c) => ({ id: c, batches: await listBatches(c) })),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Link href="/settings" className="text-sm text-zinc-400 hover:text-zinc-100">
          settings →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <Link href={`/clients/${r.id}`} className="text-base font-medium hover:text-accent">
                {r.id}
              </Link>
              <span className="text-xs text-zinc-500">{r.batches.length} batches</span>
            </div>
            <ul className="text-sm space-y-1">
              {r.batches.map((b) => (
                <li key={b}>
                  <Link
                    href={`/clients/${r.id}/batches/${b}`}
                    className="text-zinc-300 hover:text-accent"
                  >
                    {b}
                  </Link>
                </li>
              ))}
              {!r.batches.length && (
                <li className="text-zinc-500 italic">no batches yet</li>
              )}
            </ul>
          </div>
        ))}
        {!rows.length && (
          <div className="text-zinc-500 italic">
            No clients yet. Run <code>npm run seed</code> or create one below.
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Create client</h2>
        <CreateClientForm />
      </div>
    </div>
  );
}
