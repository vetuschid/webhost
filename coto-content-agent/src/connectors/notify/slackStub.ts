// Slack stub: if SLACK_WEBHOOK_URL is set we fire a real webhook; otherwise
// we just queue the message into the batch log so a human can see what would
// have been sent. Either way the surface area matches the future real impl.

export interface SlackMessage {
  text: string;
  context?: Record<string, string>;
}

export const slackStub = {
  name: 'slack',
  isReady: () => Boolean(process.env.SLACK_WEBHOOK_URL),

  async sendBatchReadyMessage(batchId: string, summary: string) {
    return send({ text: `Batch ${batchId} ready for review.\n${summary}`, context: { event: 'batch_ready', batch_id: batchId } });
  },
  async sendQACompleteMessage(batchId: string, summary: string) {
    return send({ text: `QA complete for ${batchId}.\n${summary}`, context: { event: 'qa_complete', batch_id: batchId } });
  },
  async sendApprovalSummary(batchId: string, summary: string) {
    return send({ text: `Approval summary for ${batchId}.\n${summary}`, context: { event: 'approval_summary', batch_id: batchId } });
  },
};

async function send(msg: SlackMessage) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, delivered: false, reason: 'not_configured' as const };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg.text }),
    });
    return { ok: r.ok, delivered: r.ok, reason: r.ok ? undefined : ('http_error' as const) };
  } catch (err) {
    return { ok: false, delivered: false, reason: 'fetch_failed' as const, message: String(err) };
  }
}
