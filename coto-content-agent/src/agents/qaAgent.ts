import path from 'node:path';
import { llm, type LlmMessage } from '@/connectors/llm';
import type { ClientConfig, QaOutput } from '@/schemas';
import { readText, writeText } from '@/utils/fsio';
import { promptFilename, qaFilename } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readAsBase64 } from '@/lib/imageIo';
import { readManifest, updateImage } from '@/lib/batchStore';
import { appendMistake, logEvent } from './loggingAgent';
import { runRevisionPromptForImage } from './revisionPromptAgent';
import { regenerateImage } from './imageGenerationAgent';

const SYSTEM = `You are the QA Agent for Coto Collective.

You compare ONE original image, ONE revision prompt, and ONE generated output image
to decide whether the requested edit was performed correctly.

Hard rules:
- If the output drifts from brand rules, fails to preserve text/logo as instructed,
  or does not actually perform the requested change, verdict = "fail".
- If the output is acceptable and respects preservation rules, verdict = "pass".
- If you cannot tell (e.g. quality, ambiguity), verdict = "uncertain".
- Be decisive but conservative. Flagging for human is fine.

Return STRICT JSON:
{
  "verdict": "pass" | "fail" | "uncertain",
  "reasoning": string,
  "improved_prompt": string  // ONLY if verdict == "fail"; otherwise empty string.
}

When you provide an "improved_prompt", it must be a complete replacement markdown
prompt (same shape as the original) that fixes the specific failure.`;

export async function runQaForImage(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  client: ClientConfig;
  providerName: 'openai' | 'anthropic' | 'openrouter';
  autoRetry?: boolean;
  feedback?: string;
  clarificationAnswers?: string;
}): Promise<{ qa: QaOutput; retried: boolean }> {
  const { clientId, batchId, imageId, client, providerName, autoRetry } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error('image not found');
  if (!img.current_output_path) throw new Error('no generated output to QA');

  const paths = batchPaths(clientId, batchId);
  const promptPath = path.join(
    paths.revisionPrompts,
    promptFilename(batchId, imageId, img.prompt_version),
  );
  const promptMd = await readText(promptPath);
  const originalEnc = await readAsBase64(path.join(paths.originals, img.normalized_filename));
  const outputEnc = await readAsBase64(img.current_output_path);

  const userText = [
    `Client: ${client.display_name}`,
    `Image id: ${imageId}`,
    `Prompt version: v${img.prompt_version}`,
    `Output version: v${img.output_version}`,
    '',
    '--- REVISION PROMPT USED ---',
    promptMd || '(missing)',
    '',
    '--- BRAND RULES (subset) ---',
    client.brand_rules || '(empty)',
    '',
    '--- REVIEW CRITERIA ---',
    client.review_criteria || '(empty)',
    '',
    'Two images follow: first is ORIGINAL, second is GENERATED OUTPUT. Decide pass/fail/uncertain.',
  ].join('\n');

  const parts: LlmMessage = {
    role: 'user',
    content:
      originalEnc && outputEnc
        ? [
            { type: 'text', text: userText },
            { type: 'text', text: 'ORIGINAL:' },
            { type: 'image', mediaType: originalEnc.mime, dataBase64: originalEnc.b64 },
            { type: 'text', text: 'GENERATED OUTPUT:' },
            { type: 'image', mediaType: outputEnc.mime, dataBase64: outputEnc.b64 },
          ]
        : userText,
  };

  const provider = llm(providerName);
  const raw = await provider.complete([{ role: 'system', content: SYSTEM }, parts], {
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 1800,
  });
  const parsed = safeJson(raw);

  const verdict: QaOutput['verdict'] =
    parsed.verdict === 'pass' || parsed.verdict === 'fail' || parsed.verdict === 'uncertain'
      ? (parsed.verdict as QaOutput['verdict'])
      : 'uncertain';

  const qaVersion = (img.qa_version || 0) + 1;
  const qa: QaOutput = {
    image_id: imageId,
    source_image_filename: img.normalized_filename,
    output_image_filename: path.basename(img.current_output_path),
    prompt_used_path: path.basename(promptPath),
    verdict,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    improved_prompt: typeof parsed.improved_prompt === 'string' ? parsed.improved_prompt : '',
    version: qaVersion,
  };

  await writeText(
    path.join(paths.qaReviews, qaFilename(batchId, imageId, qaVersion)),
    [
      `# QA — ${imageId} v${qaVersion}`,
      '',
      `Verdict: **${qa.verdict}**`,
      `Prompt: ${qa.prompt_used_path}`,
      `Output: ${qa.output_image_filename}`,
      '',
      '## Reasoning',
      qa.reasoning || '_none_',
      '',
      qa.improved_prompt
        ? '## Improved prompt (suggested)\n\n' + qa.improved_prompt
        : '',
      '',
    ].join('\n'),
  );

  let nextStatus: typeof img.status;
  if (verdict === 'pass') nextStatus = 'qa_passed';
  else if (verdict === 'fail') nextStatus = 'qa_failed';
  else nextStatus = 'needs_human_review';

  await updateImage(clientId, batchId, imageId, {
    status: nextStatus,
    qa_version: qaVersion,
    last_qa_verdict: verdict,
  });

  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'qa',
    image_id: imageId,
    action: 'qa_completed',
    provider_used: providerName,
    model_used: provider.defaultModel,
    qa_result: verdict,
    failure_reason: verdict === 'fail' ? qa.reasoning : undefined,
    retry_count: img.retry_count,
  });

  // Retry once on fail when autoRetry is requested.
  let retried = false;
  if (verdict === 'fail' && autoRetry && img.retry_count === 0) {
    await appendMistake(
      clientId,
      `QA fail on ${batchId}/${imageId}: ${qa.reasoning.slice(0, 240)}`,
    );

    await updateImage(clientId, batchId, imageId, { retry_count: 1 });

    // Build a v2 prompt informed by the QA failure
    await runRevisionPromptForImage({
      clientId,
      batchId,
      imageId,
      client,
      feedback: args.feedback || '',
      clarificationAnswers: args.clarificationAnswers || '',
      providerName,
      priorFailedPrompt: promptMd,
      qaFailureReason: qa.reasoning,
    });
    const regen = await regenerateImage({ clientId, batchId, imageId });
    await logEvent(clientId, batchId, {
      user: 'system',
      agent: 'qa',
      image_id: imageId,
      action: 'auto_retry_after_qa_fail',
      provider_used: regen.result.outputPath ? 'image_provider' : 'skipped',
      retry_count: 1,
    });
    await updateImage(clientId, batchId, imageId, { status: 'retry_generated' });
    retried = true;
  } else if (verdict === 'fail' && img.retry_count >= 1) {
    await updateImage(clientId, batchId, imageId, { status: 'needs_human_review' });
  }

  return { qa, retried };
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
