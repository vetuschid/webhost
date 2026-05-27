import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readText(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

export async function writeText(file: string, contents: string) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, contents, 'utf8');
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, value: unknown) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

export async function appendJsonl(file: string, value: unknown) {
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, JSON.stringify(value) + '\n', 'utf8');
}

export async function listDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function copyFile(src: string, dst: string) {
  await ensureDir(path.dirname(dst));
  await fs.copyFile(src, dst);
}
