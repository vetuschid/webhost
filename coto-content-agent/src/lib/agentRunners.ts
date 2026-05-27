// Thin wrappers so API routes and "all-image" batch endpoints share the same
// logic. Each runner pulls feedback/clarifications fresh from disk so that
// state changes between calls are picked up automatically.

import { runClarificationForImage } from '@/agents/clarificationAgent';
import { regenerateImage } from '@/agents/imageGenerationAgent';
import { runQaForImage } from '@/agents/qaAgent';
import { runReviewForImage } from '@/agents/reviewAgent';
import { runRevisionPromptForImage } from '@/agents/revisionPromptAgent';
import { readManifest } from '@/lib/batchStore';
import { feedbackForImage } from '@/lib/feedback';
import { loadClient } from '@/lib/clientLoader';

export async function review(clientId: string, batchId: string, imageId: string) {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const client = await loadClient(clientId);
  return runReviewForImage({
    clientId,
    batchId,
    imageId,
    client,
    providerName: manifest.llm_provider,
  });
}

export async function clarify(clientId: string, batchId: string, imageId: string) {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const client = await loadClient(clientId);
  const feedback = await feedbackForImage(clientId, batchId, imageId);
  return runClarificationForImage({
    clientId,
    batchId,
    imageId,
    client,
    feedback,
    providerName: manifest.llm_provider,
  });
}

export async function writePrompt(clientId: string, batchId: string, imageId: string) {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const client = await loadClient(clientId);
  const feedback = await feedbackForImage(clientId, batchId, imageId);
  return runRevisionPromptForImage({
    clientId,
    batchId,
    imageId,
    client,
    feedback,
    clarificationAnswers: '',
    providerName: manifest.llm_provider,
  });
}

export async function regenerate(clientId: string, batchId: string, imageId: string) {
  return regenerateImage({ clientId, batchId, imageId });
}

export async function qa(
  clientId: string,
  batchId: string,
  imageId: string,
  autoRetry = false,
) {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const client = await loadClient(clientId);
  const feedback = await feedbackForImage(clientId, batchId, imageId);
  return runQaForImage({
    clientId,
    batchId,
    imageId,
    client,
    providerName: manifest.llm_provider,
    autoRetry,
    feedback,
  });
}
