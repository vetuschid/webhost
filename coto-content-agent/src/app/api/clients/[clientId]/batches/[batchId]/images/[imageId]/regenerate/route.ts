import { NextResponse } from 'next/server';
import { regenerate } from '@/lib/agentRunners';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string; imageId: string }> },
) {
  const { clientId, batchId, imageId } = await ctx.params;
  try {
    const out = await regenerate(clientId, batchId, imageId);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
