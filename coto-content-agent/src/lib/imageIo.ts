import { promises as fs } from 'node:fs';
import path from 'node:path';

const ALLOWED = new Set(['.png', '.jpg', '.jpeg']);

export function imageExt(filename: string) {
  const e = path.extname(filename).toLowerCase();
  return ALLOWED.has(e) ? e : '';
}

export function mimeForExt(ext: string) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

export async function readAsBase64(absPath: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const buf = await fs.readFile(absPath);
    return { b64: buf.toString('base64'), mime: mimeForExt(path.extname(absPath).toLowerCase()) };
  } catch {
    return null;
  }
}

export async function listImageFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}
