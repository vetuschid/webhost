import { NextResponse } from 'next/server';
import { readManifest } from '@/lib/batchStore';
import { clarify } from '@/lib/agentRunners';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string }> },
) {
  const { clientId, batchId } = await ctx.params;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  const out: Record<string, unknown> = {};
  for (const img of manifest.images) {
    try {
      out[img.image_id] = await clarify(clientId, batchId, img.image_id);
    } catch (e) {
      out[img.image_id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results: out });
}
