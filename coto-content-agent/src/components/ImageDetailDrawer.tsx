'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BatchImage } from '@/schemas';
import { StatusPill } from './StatusPill';

interface Artifact {
  image_id: string;
  review: string;
  questions: string;
  prompt: string;
  qa: string;
}

export function ImageDetailDrawer({
  clientId,
  batchId,
  image,
  artifact,
  onClose,
}: {
  clientId: string;
  batchId: string;
  image: BatchImage;
  artifact: Artifact | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [feedback, setFeedback] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const originalSrc = `/api/clients/${clientId}/batches/${batchId}/file?path=${encodeURIComponent(
    'originals/' + image.normalized_filename,
  )}`;
  const outputSrc =
    image.current_output_path && image.current_output_path.includes('generated_outputs')
      ? `/api/clients/${clientId}/batches/${batchId}/file?path=${encodeURIComponent(
          'generated_outputs/' + image.current_output_path.split(/[\\/]/).pop(),
        )}`
      : null;

  async function call(suffix: string, body?: unknown) {
    setErr(null);
    const r = await fetch(
      `/api/clients/${clientId}/batches/${batchId}/images/${image.image_id}/${suffix}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!r.ok) {
      setErr((await r.json().catch(() => ({})))?.error || `${r.status}`);
      return null;
    }
    return r.json().catch(() => ({}));
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="bg-panel border-l border-edge w-full max-w-3xl h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-zinc-500">{batchId}</div>
            <div className="text-base font-semibold">{image.image_id}</div>
            <div className="text-[11px] text-zinc-500">{image.normalized_filename}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={image.status} approval={image.approval_status} />
            <button onClick={onClose} className="btn">close</button>
          </div>
        </div>

        {err && (
          <div className="border border-bad/40 bg-bad/10 text-bad text-sm rounded p-2 mb-3">
            {err}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <figure>
            <div className="text-[11px] text-zinc-500 mb-1">original</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalSrc} alt="original" className="rounded border border-edge bg-ink w-full" />
          </figure>
          <figure>
            <div className="text-[11px] text-zinc-500 mb-1">latest output (v{image.output_version})</div>
            {outputSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={outputSrc} alt="output" className="rounded border border-edge bg-ink w-full" />
            ) : (
              <div className="rounded border border-dashed border-edge text-xs text-zinc-500 italic p-6 text-center">
                no output yet
              </div>
            )}
          </figure>
        </div>

        <section className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400">Image feedback</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Make the body text ~20% larger; do not change wording."
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    if (!feedback.trim()) return;
                    await fetch(`/api/clients/${clientId}/batches/${batchId}/feedback`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        scope: 'image',
                        image_id: image.image_id,
                        text: feedback,
                      }),
                    });
                    setFeedback('');
                    router.refresh();
                  })
                }
              >
                Save feedback
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('review'); router.refresh(); })}>
                Run AI review
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('clarify'); router.refresh(); })}>
                Generate clarifying questions
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('prompt'); router.refresh(); })}>
                Generate revision prompt
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('regenerate'); router.refresh(); })}>
                Regenerate image
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('qa', { autoRetry: true }); router.refresh(); })}>
                Run QA (auto-retry)
              </button>
            </div>
          </div>

          <ArtifactBlock title="AI review" body={artifact?.review} />
          <ArtifactBlock title="Clarifying questions" body={artifact?.questions} />
          <ArtifactBlock title={`Revision prompt v${image.prompt_version}`} body={artifact?.prompt} />
          <ArtifactBlock title={`QA review v${image.qa_version}`} body={artifact?.qa} />

          <div className="border-t border-edge pt-3">
            <label className="text-xs text-zinc-400">Approval notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes attached to the approval log entry."
            />
            <div className="flex gap-2 mt-2">
              <button className="btn-good" disabled={busy} onClick={() => start(async () => { await call('approve', { notes }); router.refresh(); })}>
                Approve
              </button>
              <button className="btn-danger" disabled={busy} onClick={() => start(async () => { await call('reject', { notes }); router.refresh(); })}>
                Reject
              </button>
              <button className="btn" disabled={busy} onClick={() => start(async () => { await call('needs-revision', { notes }); router.refresh(); })}>
                Needs revision
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ArtifactBlock({ title, body }: { title: string; body?: string }) {
  return (
    <details className="border border-edge rounded p-3 bg-ink/60" open={Boolean(body)}>
      <summary className="cursor-pointer text-sm">{title}</summary>
      <pre className="text-xs whitespace-pre-wrap mt-2 text-zinc-300">
        {body || '_not generated yet_'}
      </pre>
    </details>
  );
}
