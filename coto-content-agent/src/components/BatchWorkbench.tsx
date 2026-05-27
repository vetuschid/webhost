'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BatchImage, BatchManifest, FeedbackEntry } from '@/schemas';
import type { Decision } from '@/agents/ceoAgent';
import { StatusPill } from './StatusPill';
import { ImageDetailDrawer } from './ImageDetailDrawer';

interface ArtifactBundle {
  image_id: string;
  review: string;
  questions: string;
  prompt: string;
  qa: string;
}

interface Props {
  clientId: string;
  batchId: string;
  manifest: BatchManifest;
  decisions: Decision[];
  feedback: FeedbackEntry[];
  artifacts: ArtifactBundle[];
}

export function BatchWorkbench({
  clientId,
  batchId,
  manifest,
  decisions,
  feedback,
  artifacts,
}: Props) {
  const router = useRouter();
  const [chat, setChat] = useState('');
  const [busy, setBusy] = useTransition();
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => router.refresh();

  async function call(url: string, body?: unknown) {
    setErr(null);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      setErr((await r.json().catch(() => ({})))?.error || `${r.status} ${r.statusText}`);
      return null;
    }
    return r.json().catch(() => ({}));
  }

  function ddByImage(id: string) {
    return decisions.find((d) => d.image_id === id);
  }
  function artifactByImage(id: string) {
    return artifacts.find((a) => a.image_id === id);
  }

  const openImg = openImage ? manifest.images.find((i) => i.image_id === openImage) : null;

  return (
    <div className="space-y-5">
      {err && (
        <div className="border border-bad/40 bg-bad/10 text-bad text-sm rounded p-2">
          {err}
        </div>
      )}

      {/* Batch chat */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2">Batch chat</h2>
        <p className="text-xs text-zinc-500 mb-2">
          Drop multi-image feedback here. The system maps lines like{' '}
          <code>Slide 3: …</code> to <code>slide_003</code>.
        </p>
        <textarea
          rows={5}
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Slide 1: make the smallest text easier to read..."
        />
        <div className="mt-2 flex gap-2 flex-wrap">
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              setBusy(async () => {
                if (!chat.trim()) return;
                await call(`/api/clients/${clientId}/batches/${batchId}/feedback`, {
                  scope: 'batch',
                  text: chat,
                });
                setChat('');
                refresh();
              })
            }
          >
            {busy ? '…' : 'Post feedback'}
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              setBusy(async () => {
                await call(`/api/clients/${clientId}/batches/${batchId}/review-all`);
                refresh();
              })
            }
          >
            Run AI review on all
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              setBusy(async () => {
                await call(`/api/clients/${clientId}/batches/${batchId}/clarify-all`);
                refresh();
              })
            }
          >
            Generate clarifying questions (all)
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              setBusy(async () => {
                await call(`/api/clients/${clientId}/batches/${batchId}/prompt-all`);
                refresh();
              })
            }
          >
            Generate revision prompts (all)
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              setBusy(async () => {
                await call(`/api/clients/${clientId}/batches/${batchId}/generate-all`);
                refresh();
              })
            }
          >
            Run image provider (all)
          </button>
        </div>
        {feedback.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-zinc-400 cursor-pointer">
              feedback log ({feedback.length})
            </summary>
            <ul className="text-xs mt-2 space-y-1">
              {feedback
                .slice()
                .reverse()
                .map((f, i) => (
                  <li key={i} className="text-zinc-400">
                    <span className="text-zinc-500">[{f.timestamp}]</span>{' '}
                    <span className="text-zinc-300">{f.user}</span>{' '}
                    {f.scope === 'batch' ? '(batch)' : `(${f.image_id})`} —{' '}
                    {f.text.length > 200 ? f.text.slice(0, 200) + '…' : f.text}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      {/* Image grid */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Images ({manifest.images.length})</h2>
          <div className="text-xs text-zinc-500">
            drop files in <code>data/clients/{clientId}/batches/{batchId}/originals</code>
          </div>
        </div>
        {manifest.images.length === 0 && (
          <div className="text-sm text-zinc-500 italic">
            No images yet. Drop PNG/JPEG files into the originals folder and refresh.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {manifest.images.map((img) => (
            <ImageCard
              key={img.image_id}
              clientId={clientId}
              batchId={batchId}
              img={img}
              decision={ddByImage(img.image_id)}
              artifact={artifactByImage(img.image_id)}
              onOpen={() => setOpenImage(img.image_id)}
            />
          ))}
        </div>
      </section>

      {openImg && (
        <ImageDetailDrawer
          clientId={clientId}
          batchId={batchId}
          image={openImg}
          artifact={artifactByImage(openImg.image_id) || null}
          onClose={() => setOpenImage(null)}
        />
      )}
    </div>
  );
}

function ImageCard({
  clientId,
  batchId,
  img,
  decision,
  artifact,
  onOpen,
}: {
  clientId: string;
  batchId: string;
  img: BatchImage;
  decision?: Decision;
  artifact?: ArtifactBundle;
  onOpen: () => void;
}) {
  const src = `/api/clients/${clientId}/batches/${batchId}/file?path=${encodeURIComponent(
    'originals/' + img.normalized_filename,
  )}`;
  const reviewLine = artifact?.review
    ? firstNonEmpty(artifact.review.split('\n').filter((l) => !l.startsWith('#')))
    : '';
  return (
    <div className="border border-edge rounded bg-ink/60 overflow-hidden">
      <button onClick={onOpen} className="block w-full text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={img.image_id} className="w-full h-40 object-cover bg-ink" />
      </button>
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono">{img.image_id}</span>
          <StatusPill status={img.status} approval={img.approval_status} />
        </div>
        <div className="text-[11px] text-zinc-500 truncate" title={img.normalized_filename}>
          {img.normalized_filename}
        </div>
        {reviewLine && (
          <div className="text-[11px] text-zinc-400 line-clamp-2">{reviewLine}</div>
        )}
        {decision && (
          <div className="text-[11px] text-accent/80">→ {decision.next_action}</div>
        )}
        <button className="btn w-full" onClick={onOpen}>
          Open
        </button>
      </div>
    </div>
  );
}

function firstNonEmpty(lines: string[]) {
  for (const l of lines) {
    const t = l.trim();
    if (t && !t.startsWith('_')) return t.slice(0, 160);
  }
  return '';
}
