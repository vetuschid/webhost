import path from 'node:path';
import { writeText } from '@/utils/fsio';
import type { ImageConnector, ImageEditRequest, ImageEditResult } from './types';

// prompt_only does not call any external API. It only stores the payload
// next to the (would-be) output so a human (or Hermes) can pick it up.
export class PromptOnlyImageConnector implements ImageConnector {
  name = 'prompt_only';

  isReady() {
    return true;
  }

  async edit(req: ImageEditRequest): Promise<ImageEditResult> {
    const payloadPath = req.outputPath.replace(/\.[^.]+$/, '.payload.md');
    const payload = [
      '# prompt_only payload',
      '',
      `source: ${req.sourcePath}`,
      `intended_output: ${req.outputPath}`,
      `size: ${req.size || 'preserve'}`,
      '',
      '## Prompt',
      '',
      req.prompt,
    ].join('\n');
    await writeText(payloadPath, payload);
    return {
      ok: true,
      reason: 'skipped',
      providerPayloadPath: payloadPath,
      message: `prompt_only: payload written to ${path.basename(payloadPath)}`,
    };
  }
}
