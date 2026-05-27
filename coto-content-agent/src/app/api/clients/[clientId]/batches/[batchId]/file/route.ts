import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { batchPaths } from '@/utils/paths';
import { mimeForExt } from '@/lib/imageIo';

// Serves files from within the batch folder. Paths are validated to keep
// callers inside the batch root.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ clientId: string; batchId: string }> },
) {
  const { clientId, batchId } = await ctx.params;
  const url = new URL(req.url);
  const rel = url.searchParams.get('path');
  if (!rel) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const root = batchPaths(clientId, batchId).base;
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': mimeForExt(ext),
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
