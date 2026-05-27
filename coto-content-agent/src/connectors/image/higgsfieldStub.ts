import path from 'node:path';
import { writeJson } from '@/utils/fsio';
import type { ImageConnector, ImageEditRequest, ImageEditResult } from './types';

// Higgsfield API access is unconfirmed at MVP. This stub captures everything
// a real Higgsfield call would need so we can drop in the real client later
// without changing the rest of the pipeline.
export class HiggsfieldStubConnector implements ImageConnector {
  name = 'higgsfield_stub';

  isReady() {
    return Boolean(process.env.HIGGSFIELD_API_KEY);
  }

  async edit(req: ImageEditRequest): Promise<ImageEditResult> {
    const payloadPath = req.outputPath.replace(/\.[^.]+$/, '.higgsfield.json');
    await writeJson(payloadPath, {
      provider: 'higgsfield',
      source: req.sourcePath,
      output: req.outputPath,
      size: req.size || 'preserve',
      prompt: req.prompt,
      ts: new Date().toISOString(),
    });
    return {
      ok: true,
      reason: 'skipped',
      providerPayloadPath: payloadPath,
      message: `higgsfield_stub: payload written to ${path.basename(payloadPath)}`,
    };
  }
}
