import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listBatches } from '@/lib/batchStore';
import { clientExists, loadClient } from '@/lib/clientLoader';
import { CreateBatchForm } from '@/components/CreateBatchForm';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  if (!(await clientExists(clientId))) return notFound();
  const client = await loadClient(clientId);
  const batches = await listBatches(clientId);

  const docs: { label: string; body: string }[] = [
    { label: 'brand_rules.md', body: client.brand_rules },
    { label: 'review_criteria.md', body: client.review_criteria },
    { label: 'asset_registry.md', body: client.asset_registry },
    { label: 'prompt_rules.md', body: client.prompt_rules },
    { label: 'mistakes_log.md', body: client.mistakes_log },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-500">client</div>
          <h1 className="text-xl font-semibold">{client.display_name}</h1>
          <div className="text-xs text-zinc-500 mt-1">
            local folder: <code>data/clients/{client.client_id}</code>
          </div>
        </div>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-100">← all clients</Link>
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Batches</h2>
        <ul className="text-sm space-y-1">
          {batches.map((b) => (
            <li key={b}>
              <Link
                className="text-zinc-300 hover:text-accent"
                href={`/clients/${client.client_id}/batches/${b}`}
              >
                {b}
              </Link>
            </li>
          ))}
          {!batches.length && <li className="text-zinc-500 italic">no batches yet</li>}
        </ul>
        <div className="mt-4">
          <CreateBatchForm clientId={client.client_id} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Client markdown</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {docs.map((d) => (
            <details key={d.label} className="border border-edge rounded p-3 bg-ink/60">
              <summary className="cursor-pointer text-sm">{d.label}</summary>
              <pre className="text-xs whitespace-pre-wrap mt-2 text-zinc-300">
                {d.body || '_empty_'}
              </pre>
            </details>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2">Reference assets</h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-zinc-500 mb-1">logos</div>
            <ul>{client.reference_assets.logos.map((f) => <li key={f}>{f}</li>) || null}</ul>
            {!client.reference_assets.logos.length && <em className="text-zinc-500">none</em>}
          </div>
          <div>
            <div className="text-zinc-500 mb-1">people</div>
            <ul>{client.reference_assets.people.map((f) => <li key={f}>{f}</li>) || null}</ul>
            {!client.reference_assets.people.length && <em className="text-zinc-500">none</em>}
          </div>
          <div>
            <div className="text-zinc-500 mb-1">brand_examples</div>
            <ul>{client.reference_assets.brand_examples.map((f) => <li key={f}>{f}</li>) || null}</ul>
            {!client.reference_assets.brand_examples.length && <em className="text-zinc-500">none</em>}
          </div>
        </div>
      </section>
    </div>
  );
}
