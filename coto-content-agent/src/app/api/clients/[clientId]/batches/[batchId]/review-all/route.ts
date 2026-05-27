import { NextResponse } from 'next/server';
import { readManifest } from '@/lib/batchStore';
import { review } from '@/lib/agentRunners';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string }> },
) {
  const { clientId, batchId } = await ctx.params;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  const results: Record<string, unknown> = {};
  // Run sequentially. We could parallelize, but for an A/B demo determinism
  // beats speed.
  for (const img of manifest.images) {
    try {
      results[img.image_id] = await review(clientId, batchId, img.image_id);
    } catch (e) {
      results[img.image_id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results });
}
