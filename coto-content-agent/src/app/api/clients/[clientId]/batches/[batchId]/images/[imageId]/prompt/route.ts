import { NextResponse } from 'next/server';
import { writePrompt } from '@/lib/agentRunners';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string; imageId: string }> },
) {
  const { clientId, batchId, imageId } = await ctx.params;
  try {
    const prompt = await writePrompt(clientId, batchId, imageId);
    return NextResponse.json({ ok: true, prompt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
