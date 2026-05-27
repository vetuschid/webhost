import { notFound } from 'next/navigation';
import Link from 'next/link';
import path from 'node:path';
import { readManifest } from '@/lib/batchStore';
import { loadClient, clientExists } from '@/lib/clientLoader';
import { ingestOriginalsFromFolder } from '@/lib/ingest';
import { readFeedbackLog } from '@/lib/feedback';
import { planBatch } from '@/agents/ceoAgent';
import { BatchWorkbench } from '@/components/BatchWorkbench';
import { readText } from '@/utils/fsio';
import { batchPaths } from '@/utils/paths';
import { reviewFilename, questionsFilename, promptFilename, qaFilename } from '@/utils/ids';

export const dynamic = 'force-dynamic';

export default async function BatchPage({
  params,
}: {
  params: Promise<{ clientId: string; batchId: string }>;
}) {
  const { clientId, batchId } = await params;
  if (!(await clientExists(clientId))) return notFound();

  // Make sure new files dropped in /originals are reflected in the manifest.
  await ingestOriginalsFromFolder(clientId, batchId);
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) return notFound();

  const client = await loadClient(clientId);
  const feedback = await readFeedbackLog(clientId, batchId);
  const decisions = planBatch(manifest, feedback.length > 0);
  const paths = batchPaths(clientId, batchId);

  // Preload latest artifact texts so the UI can show them server-side.
  const artifacts = await Promise.all(
    manifest.images.map(async (img) => ({
      image_id: img.image_id,
      review: await readText(path.join(paths.aiReviews, reviewFilename(img.image_id, 1))),
      questions: await readText(
        path.join(paths.clarifyingQuestions, questionsFilename(img.image_id, 1)),
      ),
      prompt:
        img.prompt_version > 0
          ? await readText(
              path.join(paths.revisionPrompts, promptFilename(batchId, img.image_id, img.prompt_version)),
            )
          : '',
      qa:
        img.qa_version > 0
          ? await readText(
              path.join(paths.qaReviews, qaFilename(batchId, img.image_id, img.qa_version)),
            )
          : '',
    })),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-500">
            <Link href={`/clients/${clientId}`} className="hover:text-zinc-100">
              {client.display_name}
            </Link>{' '}
            / batch
          </div>
          <h1 className="text-xl font-semibold">{batchId}</h1>
          <div className="text-xs text-zinc-500 mt-1">
            llm: <code>{manifest.llm_provider}</code> · image:{' '}
            <code>{manifest.image_provider}</code> · {manifest.images.length} images
          </div>
        </div>
        <Link href={`/clients/${clientId}`} className="text-xs text-zinc-400 hover:text-zinc-100">
          ← {client.display_name}
        </Link>
      </div>

      <BatchWorkbench
        clientId={clientId}
        batchId={batchId}
        manifest={manifest}
        decisions={decisions}
        feedback={feedback}
        artifacts={artifacts}
      />
    </div>
  );
}
