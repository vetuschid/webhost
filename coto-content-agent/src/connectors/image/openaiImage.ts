import { promises as fs } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { ensureDir } from '@/utils/fsio';
import type { ImageConnector, ImageEditRequest, ImageEditResult } from './types';

// Uses OpenAI's image-edit endpoint (gpt-image-1). For PNG/JPEG inputs we
// pass the raw source as the image to edit. We do not pass a mask -
// gpt-image-1 will treat the prompt as a full instruction.
export class OpenAIImageConnector implements ImageConnector {
  name = 'openai_image';

  isReady() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async edit(req: ImageEditRequest): Promise<ImageEditResult> {
    if (!this.isReady()) {
      return { ok: false, reason: 'error', message: 'OPENAI_API_KEY not set' };
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
      const buf = await fs.readFile(req.sourcePath);
      const file = await OpenAI.toFile(
        buf,
        path.basename(req.sourcePath),
        { type: req.sourcePath.toLowerCase().endsWith('.jpg') || req.sourcePath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png' },
      );
      const resp = await client.images.edit({
        model: 'gpt-image-1',
        image: file,
        prompt: req.prompt,
        size: (req.size as '1024x1024' | '1024x1536' | '1536x1024' | 'auto' | undefined) ?? 'auto',
      });

      const b64 = resp.data?.[0]?.b64_json;
      if (!b64) {
        return { ok: false, reason: 'error', message: 'No image returned' };
      }
      await ensureDir(path.dirname(req.outputPath));
      await fs.writeFile(req.outputPath, Buffer.from(b64, 'base64'));
      return { ok: true, outputPath: req.outputPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: 'error', message };
    }
  }
}
