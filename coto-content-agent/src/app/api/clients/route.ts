import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDir, fileExists } from '@/utils/fsio';
import { slugify } from '@/utils/ids';
import { clientFiles, clientReferenceRoot, clientRoot } from '@/utils/paths';
import { listClientIds } from '@/lib/clientLoader';

export async function GET() {
  return NextResponse.json({ clients: await listClientIds() });
}

export async function POST(req: Request) {
  const { client_id } = (await req.json().catch(() => ({}))) as { client_id?: string };
  if (!client_id) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 });
  }
  const id = slugify(client_id);
  if (!id) return NextResponse.json({ error: 'invalid client_id' }, { status: 400 });

  const root = clientRoot(id);
  await ensureDir(root);
  await ensureDir(path.join(clientReferenceRoot(id), 'logos'));
  await ensureDir(path.join(clientReferenceRoot(id), 'people'));
  await ensureDir(path.join(clientReferenceRoot(id), 'brand_examples'));

  const files = clientFiles(id);
  const templates: Record<string, string> = {
    [files.brandRules]: `# ${id} Brand Rules\n\n_(seeded)_\n`,
    [files.reviewCriteria]: `# Review Criteria\n\n_(seeded)_\n`,
    [files.assetRegistry]: `# Asset Registry\n\n_(seeded)_\n`,
    [files.promptRules]: `# Revision Prompt Rules\n\n_(seeded)_\n`,
    [files.mistakesLog]: `# Mistakes Log\n`,
  };
  for (const [file, body] of Object.entries(templates)) {
    if (!(await fileExists(file))) {
      await fs.writeFile(file, body, 'utf8');
    }
  }

  return NextResponse.json({ client_id: id });
}
