import { NextResponse } from 'next/server';
import { qa } from '@/lib/agentRunners';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string; imageId: string }> },
) {
  const { clientId, batchId, imageId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { autoRetry?: boolean };
  try {
    const out = await qa(clientId, batchId, imageId, Boolean(body.autoRetry));
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
