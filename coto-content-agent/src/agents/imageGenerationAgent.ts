import path from 'node:path';
import { imageProvider, type ImageEditResult } from '@/connectors/image';
import type { ImageProvider } from '@/schemas';
import { readText } from '@/utils/fsio';
import { outputFilename, promptFilename } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readManifest, updateImage } from '@/lib/batchStore';
import { logEvent } from './loggingAgent';

// One image edit call per image. Never overwrites originals. Deterministic
// filenames. Provider is selected per call; default comes from manifest.

export async function regenerateImage(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  provider?: ImageProvider;
}): Promise<{ result: ImageEditResult; outputFilename: string; version: number }> {
  const { clientId, batchId, imageId } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error('image not found');
  if (img.prompt_version === 0) {
    throw new Error('no revision prompt has been generated yet');
  }

  const provider = args.provider || manifest.image_provider;
  const paths = batchPaths(clientId, batchId);
  const ext = path.extname(img.normalized_filename) || '.png';
  const sourcePath = path.join(paths.originals, img.normalized_filename);
  const nextOutputVersion = img.prompt_version; // tie outputs to prompt versions
  const outName = outputFilename(batchId, imageId, nextOutputVersion, ext);
  const outPath = path.join(paths.generatedOutputs, outName);
  const promptPath = path.join(
    paths.revisionPrompts,
    promptFilename(batchId, imageId, img.prompt_version),
  );
  const prompt = await readText(promptPath);
  if (!prompt) throw new Error(`prompt missing: ${promptPath}`);

  await updateImage(clientId, batchId, imageId, { status: 'regeneration_pending' });

  const connector = imageProvider(provider);
  const result = await connector.edit({
    prompt,
    sourcePath,
    outputPath: outPath,
  });

  const finalStatus = result.ok
    ? result.reason === 'skipped'
      ? 'revision_prompt_created'
      : 'regenerated'
    : 'qa_failed';

  await updateImage(clientId, batchId, imageId, {
    status: finalStatus,
    output_version: nextOutputVersion,
    current_output_path: result.outputPath || result.providerPayloadPath || '',
  });

  await logEvent(clientId, batchId, {
    user: 'system',
    agent: 'image_generation',
    image_id: imageId,
    action: 'image_edit_called',
    provider_used: provider,
    prompt_used: path.basename(promptPath),
    result: result.ok ? (result.reason === 'skipped' ? 'skipped' : 'ok') : 'error',
    failure_reason: result.ok ? undefined : result.message,
    final_status: finalStatus,
  });

  return { result, outputFilename: outName, version: nextOutputVersion };
}
