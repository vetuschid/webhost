import { NextResponse } from 'next/server';
import { appendFeedback } from '@/lib/feedback';
import { logEvent } from '@/agents/loggingAgent';
import { activeUser } from '@/utils/env';
import { FeedbackEntry } from '@/schemas';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string }> },
) {
  const { clientId, batchId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<FeedbackEntry>;
  const user = activeUser();

  if (!body.scope || !body.text) {
    return NextResponse.json({ error: 'scope+text required' }, { status: 400 });
  }
  const entry = await appendFeedback(clientId, batchId, {
    user: user.name,
    scope: body.scope,
    image_id: body.image_id,
    text: body.text,
  });
  await logEvent(clientId, batchId, {
    user: user.name,
    agent: 'human',
    image_id: body.image_id,
    action: 'feedback_posted',
    result: `${body.scope}`,
  });
  return NextResponse.json({ ok: true, entry });
}
