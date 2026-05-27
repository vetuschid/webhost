import path from 'node:path';
import { LocalStorageConnector } from '@/connectors/storage/localStorage';
import { listImageFiles } from '@/lib/imageIo';
import { BatchManifest } from '@/schemas';
import { imageIdFromIndex, normalizedOriginal } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';
import { readManifest, writeManifest } from './batchStore';

const storage = new LocalStorageConnector();

// Walks originals/ folder, normalizes filenames into the manifest, and copies
// raw files into deterministic names if needed. Originals are never deleted.
export async function ingestOriginalsFromFolder(
  clientId: string,
  batchId: string,
): Promise<BatchManifest> {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error(`batch not found: ${clientId}/${batchId}`);
  const paths = batchPaths(clientId, batchId);
  const files = await listImageFiles(paths.originals);

  // Drop any normalized files we've already accounted for.
  const known = new Set(manifest.images.map((i) => i.original_filename));
  // We treat normalized_filename presence as also-known to avoid double ingest.
  const knownNormalized = new Set(manifest.images.map((i) => i.normalized_filename));

  // Order: anything not already normalized gets an id appended.
  let nextIndex = manifest.images.length + 1;
  for (const f of files) {
    if (knownNormalized.has(f)) continue;
    if (known.has(f)) continue;
    const ext = path.extname(f).toLowerCase();
    const imageId = imageIdFromIndex(nextIndex);
    const normalized = normalizedOriginal(batchId, imageId, ext);
    const src = path.join(paths.originals, f);
    const dst = path.join(paths.originals, normalized);
    if (src !== dst) {
      await storage.ingestOriginal({ sourcePath: src, destPath: dst });
    }
    manifest.images.push({
      image_id: imageId,
      original_filename: f,
      normalized_filename: normalized,
      status: 'uploaded',
      current_output_path: '',
      approval_status: '',
      retry_count: 0,
      prompt_version: 0,
      output_version: 0,
      qa_version: 0,
      last_qa_verdict: '',
    });
    nextIndex += 1;
  }

  await writeManifest(clientId, manifest);
  return manifest;
}
