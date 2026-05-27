import path from 'node:path';
import { llm, type LlmMessage } from '@/connectors/llm';
import type { ClientConfig, ReviewOutput } from '@/schemas';
import { writeText } from '@/utils/fsio';
import { reviewFilename } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readAsBase64 } from '@/lib/imageIo';
import { readManifest, setImageStatus } from '@/lib/batchStore';
import { logEvent } from './loggingAgent';

const SYSTEM = `You are the Review Agent for Coto Collective.
You review one client image at a time against the client's brand and content rules.

Strict rules:
- Do NOT recommend random creative changes.
- Do NOT rewrite copy unless flagged for an explicit error (e.g. spelling).
- Preserve the original design intent unless the human asks to change it.
- Your job is to surface issues, not to redesign.

Review categories: spelling, brand_accuracy, logo_check, text_readability, text_size,
layout_consistency, preservation_of_required_design_elements, client_specific_rules,
reference_asset_usage.

Output STRICT JSON with this shape:
{
  "detected_text": string,
  "visible_design_summary": string,
  "issues": string[],
  "risks": string[],
  "status": "clean" | "issues" | "needs_clarification",
  "recommended_next_action": string,
  "questions_needed": string[]
}`;

export async function runReviewForImage(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  client: ClientConfig;
  providerName: 'openai' | 'anthropic' | 'openrouter';
}): Promise<ReviewOutput> {
  const { clientId, batchId, imageId, client, providerName } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error(`batch not found ${clientId}/${batchId}`);
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error(`image not found ${imageId}`);

  const paths = batchPaths(clientId, batchId);
  const imagePath = path.join(paths.originals, img.normalized_filename);
  const encoded = await readAsBase64(imagePath);

  const userText = [
    `Client: ${client.display_name}`,
    `Image id: ${imageId}`,
    `Source file: ${img.normalized_filename}`,
    '',
    '--- BRAND RULES ---',
    client.brand_rules || '(empty)',
    '',
    '--- REVIEW CRITERIA ---',
    client.review_criteria || '(empty)',
    '',
    '--- PROMPT RULES ---',
    client.prompt_rules || '(empty)',
    '',
    '--- MISTAKES LOG (past patterns to avoid) ---',
    client.mistakes_log || '(empty)',
    '',
    'Review this single image and return ONLY the JSON object specified.',
  ].join('\n');

  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: encoded
        ? [
            { type: 'text', text: userText },
            { type: 'image', mediaType: encoded.mime, dataBase64: encoded.b64 },
          ]
        : userText,
    },
  ];

  const provider = llm(providerName);
  const raw = await provider.complete(messages, { jsonMode: true, temperature: 0.1 });
  const parsed = safeParseJson(raw);

  const out: ReviewOutput = {
    image_id: imageId,
    source_file: img.normalized_filename,
    detected_text: typeof parsed.detected_text === 'string' ? parsed.detected_text : '',
    visible_design_summary:
      typeof parsed.visible_design_summary === 'string' ? parsed.visible_design_summary : '',
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    status:
      parsed.status === 'clean' || parsed.status === 'issues' || parsed.status === 'needs_clarification'
        ? parsed.status
        : 'issues',
    recommended_next_action:
      typeof parsed.recommended_next_action === 'string' ? parsed.recommended_next_action : '',
    questions_needed: Array.isArray(parsed.questions_needed)
      ? parsed.questions_needed.map(String)
      : [],
  };

  const md = formatReviewMarkdown(out);
  await writeText(path.join(paths.aiReviews, reviewFilename(imageId, 1)), md);
  await setImageStatus(clientId, batchId, imageId, 'ai_reviewed');
  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'review',
    image_id: imageId,
    action: 'review_completed',
    provider_used: providerName,
    model_used: provider.defaultModel,
    result: out.status,
  });

  return out;
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}

function formatReviewMarkdown(r: ReviewOutput): string {
  return [
    `# Review — ${r.image_id}`,
    '',
    `Source: ${r.source_file}`,
    `Status: ${r.status}`,
    '',
    '## Detected text',
    r.detected_text || '_none_',
    '',
    '## Visible design summary',
    r.visible_design_summary || '_none_',
    '',
    '## Issues',
    r.issues.length ? r.issues.map((x) => `- ${x}`).join('\n') : '_none_',
    '',
    '## Risks',
    r.risks.length ? r.risks.map((x) => `- ${x}`).join('\n') : '_none_',
    '',
    '## Recommended next action',
    r.recommended_next_action || '_n/a_',
    '',
    '## Questions needed',
    r.questions_needed.length ? r.questions_needed.map((x) => `- ${x}`).join('\n') : '_none_',
    '',
  ].join('\n');
}
