import { NextResponse } from 'next/server';
import { ensureBatchDirs, listBatches, newBatchManifest, nextBatchId, writeManifest } from '@/lib/batchStore';
import { clientExists } from '@/lib/clientLoader';
import { defaultImageProvider, defaultLlmProvider, activeUser } from '@/utils/env';

export async function GET(_req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await ctx.params;
  return NextResponse.json({ batches: await listBatches(clientId) });
}

export async function POST(_req: Request, ctx: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await ctx.params;
  if (!(await clientExists(clientId))) {
    return NextResponse.json({ error: 'client not found' }, { status: 404 });
  }
  const existing = await listBatches(clientId);
  const batchId = nextBatchId(existing);
  await ensureBatchDirs(clientId, batchId);
  const user = activeUser();
  const manifest = newBatchManifest({
    clientId,
    batchId,
    createdBy: user.name,
    llmProvider: defaultLlmProvider(),
    imageProvider: defaultImageProvider(),
  });
  await writeManifest(clientId, manifest);
  return NextResponse.json({ batch_id: batchId });
}
