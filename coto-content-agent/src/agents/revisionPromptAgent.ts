import path from 'node:path';
import { llm, type LlmMessage } from '@/connectors/llm';
import type { ClientConfig, RevisionPrompt } from '@/schemas';
import { readText, writeText } from '@/utils/fsio';
import { outputFilename, promptFilename } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readAsBase64 } from '@/lib/imageIo';
import { readManifest, updateImage } from '@/lib/batchStore';
import { logEvent } from './loggingAgent';

const SYSTEM = `You are the Revision Prompt Agent for Coto Collective.

You write ONE dedicated image-edit prompt for ONE image at a time.

Required sections (use exactly these headings, in this order):
1. Source image filename
2. Target output filename
3. Exact edits requested
4. What MUST stay unchanged
5. Logo preservation rules
6. Text preservation rules
7. Dimensions / aspect ratio
8. Reference asset instructions
9. Negative constraints
10. Output quality requirements

Hard language requirements - include verbatim:
- "Preserve exact aspect ratio and dimensions."
- "Preserve all wording exactly unless explicitly instructed otherwise."
- "Preserve the LensLock logo exactly with no distortion, recoloring, redraw, drift, glow, or added marks." (only when client is LensLock or logo present)
- "Make only the requested changes."

If any requested edit conflicts with logo/text preservation, prioritize preservation
and add a note flagging the conflict for human review.

Return ONLY the markdown body of the prompt. No JSON, no preamble.`;

export async function runRevisionPromptForImage(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  client: ClientConfig;
  feedback: string;
  clarificationAnswers: string;
  providerName: 'openai' | 'anthropic' | 'openrouter';
  priorFailedPrompt?: string;
  qaFailureReason?: string;
}): Promise<RevisionPrompt> {
  const {
    clientId,
    batchId,
    imageId,
    client,
    feedback,
    clarificationAnswers,
    providerName,
    priorFailedPrompt,
    qaFailureReason,
  } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error('image not found');

  const paths = batchPaths(clientId, batchId);
  const imagePath = path.join(paths.originals, img.normalized_filename);
  const encoded = await readAsBase64(imagePath);
  const nextVersion = (img.prompt_version || 0) + 1;
  const ext = path.extname(img.normalized_filename) || '.png';
  const targetOutput = outputFilename(batchId, imageId, nextVersion, ext);

  const userText = [
    `Client: ${client.display_name}`,
    `Image id: ${imageId}`,
    `Source image filename: ${img.normalized_filename}`,
    `Target output filename: ${targetOutput}`,
    '',
    '--- BRAND RULES ---',
    client.brand_rules || '(empty)',
    '',
    '--- PROMPT RULES ---',
    client.prompt_rules || '(empty)',
    '',
    '--- ASSET REGISTRY ---',
    client.asset_registry || '(empty)',
    '',
    '--- REFERENCE ASSETS AVAILABLE ---',
    `logos: ${client.reference_assets.logos.join(', ') || '(none)'}`,
    `people: ${client.reference_assets.people.join(', ') || '(none)'}`,
    `brand_examples: ${client.reference_assets.brand_examples.join(', ') || '(none)'}`,
    '',
    '--- HUMAN FEEDBACK ---',
    feedback || '(none)',
    '',
    '--- CLARIFICATION ANSWERS ---',
    clarificationAnswers || '(none)',
    '',
    priorFailedPrompt
      ? `--- PRIOR FAILED PROMPT (v${nextVersion - 1}) ---\n${priorFailedPrompt}\n\n--- QA FAILURE REASON ---\n${qaFailureReason || '(unspecified)'}\n\nProduce an improved prompt that addresses the failure.`
      : '',
    '',
    `Write the markdown prompt now. Use the exact target output filename: ${targetOutput}.`,
  ]
    .filter(Boolean)
    .join('\n');

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
  const promptMd = await provider.complete(messages, { temperature: 0.2, maxTokens: 1800 });

  const filePath = path.join(paths.revisionPrompts, promptFilename(batchId, imageId, nextVersion));
  await writeText(filePath, promptMd.trim() + '\n');

  await updateImage(clientId, batchId, imageId, {
    status: 'revision_prompt_created',
    prompt_version: nextVersion,
  });

  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'revision_prompt',
    image_id: imageId,
    action: 'prompt_generated',
    provider_used: providerName,
    model_used: provider.defaultModel,
    prompt_used: path.basename(filePath),
    result: `v${nextVersion}`,
  });

  return {
    image_id: imageId,
    source_image_filename: img.normalized_filename,
    target_output_filename: targetOutput,
    prompt_markdown: promptMd,
    version: nextVersion,
  };
}

export async function readLatestPrompt(
  clientId: string,
  batchId: string,
  imageId: string,
  version: number,
): Promise<string> {
  const file = path.join(
    batchPaths(clientId, batchId).revisionPrompts,
    promptFilename(batchId, imageId, version),
  );
  return readText(file);
}
