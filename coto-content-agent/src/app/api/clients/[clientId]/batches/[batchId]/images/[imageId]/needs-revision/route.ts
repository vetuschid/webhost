import { NextResponse } from 'next/server';
import { recordApproval } from '@/lib/approvals';
import { activeUser } from '@/utils/env';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string; imageId: string }> },
) {
  const { clientId, batchId, imageId } = await ctx.params;
  const { notes } = (await req.json().catch(() => ({}))) as { notes?: string };
  const user = activeUser();
  try {
    const entry = await recordApproval({
      clientId,
      batchId,
      imageId,
      status: 'needs_revision',
      user: user.name,
      role: user.role,
      notes,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
