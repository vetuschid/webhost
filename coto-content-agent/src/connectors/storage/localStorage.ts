import { promises as fs } from 'node:fs';
import path from 'node:path';
import { copyFile, ensureDir } from '@/utils/fsio';

// Local storage is the default and currently the only fully wired storage.
// Other connectors (gdrive, dropbox) share this interface so they can swap
// in once their auth is configured.
export interface StorageConnector {
  name: string;
  isReady(): boolean;
  ingestOriginal(args: {
    sourcePath: string;
    destPath: string;
  }): Promise<{ ok: true; path: string }>;
  promoteApproved(args: {
    sourcePath: string;
    destPath: string;
  }): Promise<{ ok: true; path: string }>;
}

export class LocalStorageConnector implements StorageConnector {
  name = 'local';
  isReady() {
    return true;
  }

  async ingestOriginal({ sourcePath, destPath }: { sourcePath: string; destPath: string }) {
    await ensureDir(path.dirname(destPath));
    await copyFile(sourcePath, destPath);
    return { ok: true as const, path: destPath };
  }

  async promoteApproved({ sourcePath, destPath }: { sourcePath: string; destPath: string }) {
    await ensureDir(path.dirname(destPath));
    await fs.copyFile(sourcePath, destPath);
    return { ok: true as const, path: destPath };
  }
}
