// CEO Agent: routes the workflow. v1 is intentionally deterministic - it
// inspects manifest state and decides the next agent to call. Future versions
// can swap in an LLM-driven router, but the deterministic version is enough
// to drive the demo and to be A/B-tested against Hermes.

import type { BatchImage, BatchManifest, ClientConfig } from '@/schemas';
import { logEvent } from './loggingAgent';

export type Action =
  | 'review'
  | 'ask_for_feedback'
  | 'clarify'
  | 'write_prompt'
  | 'regenerate'
  | 'run_qa'
  | 'human_review'
  | 'approve_or_reject'
  | 'done';

export interface Decision {
  image_id: string;
  current_status: BatchImage['status'];
  next_action: Action;
  reasoning: string;
}

export function nextActionFor(img: BatchImage, batchHasFeedback: boolean): Decision {
  const r = (next_action: Action, reasoning: string): Decision => ({
    image_id: img.image_id,
    current_status: img.status,
    next_action,
    reasoning,
  });

  switch (img.status) {
    case 'uploaded':
      return r('review', 'Image is new; run AI review first.');
    case 'ai_reviewed':
      return batchHasFeedback
        ? r('clarify', 'Review done; feedback present; check if clarification needed.')
        : r('ask_for_feedback', 'Review done; waiting on human feedback.');
    case 'awaiting_human_feedback':
      return r('ask_for_feedback', 'Need human feedback.');
    case 'clarification_needed':
      return r('ask_for_feedback', 'Human must answer clarifying questions.');
    case 'clarification_answered':
      return r('write_prompt', 'Answers in; write revision prompt.');
    case 'revision_prompt_created':
      return r('regenerate', 'Prompt ready; call image provider.');
    case 'regeneration_pending':
      return r('regenerate', 'Regeneration is in flight.');
    case 'regenerated':
      return r('run_qa', 'Output exists; run QA review.');
    case 'qa_passed':
      return r('approve_or_reject', 'Awaiting human approval.');
    case 'qa_failed':
      return img.retry_count >= 1
        ? r('human_review', 'QA failed after retry; needs human.')
        : r('regenerate', 'QA failed once; retry with improved prompt.');
    case 'retry_generated':
      return r('run_qa', 'Retry output exists; re-run QA.');
    case 'needs_human_review':
      return r('human_review', 'Flagged for human review.');
    case 'approved':
      return r('done', 'Approved.');
    case 'rejected':
      return r('done', 'Rejected.');
    case 'delivered':
      return r('done', 'Delivered.');
  }
}

export function planBatch(
  manifest: BatchManifest,
  batchHasFeedback: boolean,
): Decision[] {
  return manifest.images.map((i) => nextActionFor(i, batchHasFeedback));
}

export async function logRoutingDecision(
  clientId: string,
  batchId: string,
  decision: Decision,
  client: ClientConfig,
) {
  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'ceo',
    image_id: decision.image_id,
    action: `route:${decision.next_action}`,
    notes: `${client.client_id} :: ${decision.reasoning}`,
  });
}
