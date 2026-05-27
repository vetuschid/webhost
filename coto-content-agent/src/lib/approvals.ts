import path from 'node:path';
import { LocalStorageConnector } from '@/connectors/storage/localStorage';
import type { ApprovalEntry, Role } from '@/schemas';
import { logEvent } from '@/agents/loggingAgent';
import { readApprovalLog, readManifest, updateImage, writeApprovalLog } from '@/lib/batchStore';
import { finalFilename, nowIso } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';

const storage = new LocalStorageConnector();

export async function recordApproval(args: {
  clientId: string;
  batchId: string;
  imageId: string;
  status: 'approved' | 'rejected' | 'needs_revision';
  user: string;
  role: Role;
  notes?: string;
}) {
  const { clientId, batchId, imageId, status, user, role, notes } = args;
  const manifest = await readManifest(clientId, batchId);
  if (!manifest) throw new Error('batch not found');
  const img = manifest.images.find((i) => i.image_id === imageId);
  if (!img) throw new Error('image not found');

  const log = await readApprovalLog(clientId, batchId);
  const paths = batchPaths(clientId, batchId);

  let approvedFilePath = '';
  if (status === 'approved' && img.current_output_path) {
    const ext = path.extname(img.current_output_path) || '.png';
    const finalName = finalFilename(batchId, imageId, ext);
    approvedFilePath = path.join(paths.approved, finalName);
    await storage.promoteApproved({
      sourcePath: img.current_output_path,
      destPath: approvedFilePath,
    });
  } else if (status === 'rejected' && img.current_output_path) {
    const ext = path.extname(img.current_output_path) || '.png';
    const name = `${batchId}_${imageId}_rejected${ext}`;
    const dst = path.join(paths.rejected, name);
    await storage.promoteApproved({
      sourcePath: img.current_output_path,
      destPath: dst,
    });
  }

  const entry: ApprovalEntry = {
    image_id: imageId,
    status,
    approved_by: user,
    role,
    timestamp: nowIso(),
    approved_file_path: approvedFilePath,
    notes: notes ?? '',
  };
  log.approvals.push(entry);
  await writeApprovalLog(clientId, log);

  await updateImage(clientId, batchId, imageId, {
    approval_status: status,
    status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'needs_human_review',
  });

  await logEvent(clientId, batchId, {
    user,
    agent: 'human',
    image_id: imageId,
    action: 'approval_recorded',
    result: status,
    notes: notes || '',
  });

  return entry;
}
