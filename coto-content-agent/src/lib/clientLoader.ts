import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ClientConfig } from '@/schemas';
import { listDir, readText } from '@/utils/fsio';
import { clientFiles, clientReferenceRoot, clientRoot, clientsRoot } from '@/utils/paths';

export async function listClientIds(): Promise<string[]> {
  const entries = await listDir(clientsRoot());
  const out: string[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    try {
      const s = await fs.stat(path.join(clientsRoot(), name));
      if (s.isDirectory()) out.push(name);
    } catch {
      /* skip */
    }
  }
  return out.sort();
}

export async function loadClient(clientId: string): Promise<ClientConfig> {
  const files = clientFiles(clientId);
  const ref = clientReferenceRoot(clientId);
  const display = clientId
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    client_id: clientId,
    display_name: display,
    brand_rules: await readText(files.brandRules),
    review_criteria: await readText(files.reviewCriteria),
    asset_registry: await readText(files.assetRegistry),
    prompt_rules: await readText(files.promptRules),
    mistakes_log: await readText(files.mistakesLog),
    reference_assets: {
      logos: await listDir(path.join(ref, 'logos')),
      people: await listDir(path.join(ref, 'people')),
      brand_examples: await listDir(path.join(ref, 'brand_examples')),
    },
  };
}

export async function clientExists(clientId: string): Promise<boolean> {
  try {
    const s = await fs.stat(clientRoot(clientId));
    return s.isDirectory();
  } catch {
    return false;
  }
}
