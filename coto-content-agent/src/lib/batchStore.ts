import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ApprovalLog,
  type BatchImage,
  BatchManifest,
  type ImageStatus,
} from '@/schemas';
import { ensureDir, listDir, readJson, writeJson } from '@/utils/fsio';
import { nowIso } from '@/utils/ids';
import { batchPaths, batchesRoot, clientRoot } from '@/utils/paths';

export async function listBatches(clientId: string): Promise<string[]> {
  const dirs = await listDir(batchesRoot(clientId));
  const out: string[] = [];
  for (const name of dirs) {
    if (name.startsWith('.')) continue;
    const s = await fs.stat(path.join(batchesRoot(clientId), name)).catch(() => null);
    if (s?.isDirectory()) out.push(name);
  }
  return out.sort();
}

export async function readManifest(
  clientId: string,
  batchId: string,
): Promise<BatchManifest | null> {
  const file = batchPaths(clientId, batchId).manifest;
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return BatchManifest.parse(parsed);
  } catch {
    return null;
  }
}

export async function writeManifest(clientId: string, manifest: BatchManifest) {
  const file = batchPaths(clientId, manifest.batch_id).manifest;
  await writeJson(file, manifest);
}

export async function readApprovalLog(clientId: string, batchId: string) {
  const file = batchPaths(clientId, batchId).approvalLog;
  const fallback = ApprovalLog.parse({ batch_id: batchId, approvals: [] });
  const data = await readJson(file, fallback);
  return ApprovalLog.parse(data);
}

export async function writeApprovalLog(clientId: string, log: ReturnType<typeof ApprovalLog.parse>) {
  const file = batchPaths(clientId, log.batch_id).approvalLog;
  await writeJson(file, log);
}

export async function ensureBatchDirs(clientId: string, batchId: string) {
  const p = batchPaths(clientId, batchId);
  await ensureDir(clientRoot(clientId));
  for (const dir of [
    p.base,
    p.originals,
    p.humanFeedback,
    p.aiReviews,
    p.clarifyingQuestions,
    p.revisionPrompts,
    p.generatedOutputs,
    p.qaReviews,
    p.approved,
    p.rejected,
    p.logs,
  ]) {
    await ensureDir(dir);
  }
}

export function nextBatchId(existing: string[]): string {
  const nums = existing
    .map((b) => /^batch_(\d+)$/.exec(b)?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n as string, 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `batch_${String(next).padStart(3, '0')}`;
}

export async function updateImage(
  clientId: string,
  batchId: string,
  imageId: string,
  patch: Partial<BatchImage>,
) {
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error(`batch not found: ${clientId}/${batchId}`);
  const idx = manifest.images.findIndex((i) => i.image_id === imageId);
  if (idx === -1) throw new Error(`image not found: ${imageId}`);
  manifest.images[idx] = { ...manifest.images[idx], ...patch };
  await writeManifest(clientId, manifest);
  return manifest.images[idx];
}

export async function setImageStatus(
  clientId: string,
  batchId: string,
  imageId: string,
  status: ImageStatus,
) {
  return updateImage(clientId, batchId, imageId, { status });
}

export function newBatchManifest(args: {
  clientId: string;
  batchId: string;
  createdBy: string;
  llmProvider: BatchManifest['llm_provider'];
  imageProvider: BatchManifest['image_provider'];
}): BatchManifest {
  return BatchManifest.parse({
    client_id: args.clientId,
    batch_id: args.batchId,
    created_at: nowIso(),
    created_by: args.createdBy,
    content_type: 'static_images',
    status: 'open',
    storage_mode: 'local',
    llm_provider: args.llmProvider,
    image_provider: args.imageProvider,
    images: [],
  });
}
