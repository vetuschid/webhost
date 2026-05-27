import { NextResponse } from 'next/server';
import { review } from '@/lib/agentRunners';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string; imageId: string }> },
) {
  const { clientId, batchId, imageId } = await ctx.params;
  try {
    const out = await review(clientId, batchId, imageId);
    return NextResponse.json({ ok: true, review: out });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
