import path from 'node:path';
import { llm, type LlmMessage } from '@/connectors/llm';
import type { ClientConfig } from '@/schemas';
import { writeText } from '@/utils/fsio';
import { questionsFilename } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readAsBase64 } from '@/lib/imageIo';
import { readManifest, setImageStatus } from '@/lib/batchStore';
import { logEvent } from './loggingAgent';

const SYSTEM = `You are the Clarification Agent for Coto Collective.

Goal: produce 5-10 deterministic, specific, image-level questions that, if answered,
would let an image-editing model perform the requested change WITHOUT failing.

Hard rules:
- Be specific. No vague strategy questions.
- Do NOT ask questions that are already answered by feedback below.
- Each question must be about THIS image specifically.
- Questions must reduce the chance of edit failure (pixel placement, font size,
  logo position, what to preserve, what to change, etc.).
- If feedback is already complete, return fewer questions or an empty array.

Return STRICT JSON: { "questions": string[] }`;

export async function runClarificationForImage(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  client: ClientConfig;
  feedback: string;
  providerName: 'openai' | 'anthropic' | 'openrouter';
}): Promise<string[]> {
  const { clientId, batchId, imageId, client, feedback, providerName } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error('image not found');

  const paths = batchPaths(clientId, batchId);
  const imagePath = path.join(paths.originals, img.normalized_filename);
  const encoded = await readAsBase64(imagePath);

  const userText = [
    `Client: ${client.display_name}`,
    `Image id: ${imageId}`,
    `Source file: ${img.normalized_filename}`,
    '',
    '--- BRAND RULES (subset) ---',
    client.brand_rules || '(empty)',
    '',
    '--- HUMAN FEEDBACK FOR THIS IMAGE ---',
    feedback || '(no feedback yet)',
    '',
    'Return the JSON object with the "questions" array.',
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
  const raw = await provider.complete(messages, { jsonMode: true, temperature: 0.2 });
  const parsed = safeJson(raw);
  const questions = Array.isArray(parsed.questions) ? parsed.questions.map(String) : [];

  await writeText(
    path.join(paths.clarifyingQuestions, questionsFilename(imageId, 1)),
    [
      `# Clarifying questions — ${imageId}`,
      '',
      questions.length ? questions.map((q, i) => `${i + 1}. ${q}`).join('\n') : '_no questions needed_',
      '',
    ].join('\n'),
  );

  await setImageStatus(clientId, batchId, imageId, questions.length ? 'clarification_needed' : 'clarification_answered');
  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'clarification',
    image_id: imageId,
    action: 'questions_generated',
    provider_used: providerName,
    model_used: provider.defaultModel,
    result: `${questions.length} questions`,
  });

  return questions;
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch { /* fall through */ }
    return {};
  }
}
