#!/usr/bin/env tsx
/**
 * Seed script: ensures the LensLock client folder + batch_001 skeleton exists.
 * Safe to run repeatedly. Does not overwrite existing markdown.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDir, fileExists } from '../src/utils/fsio';
import { batchPaths, clientFiles, clientReferenceRoot, clientRoot } from '../src/utils/paths';

const TEMPLATES: Record<string, string> = {
  brand_rules: `# LensLock Brand Rules\n\n_(seeded - edit me)_\n`,
  review_criteria: `# Review Criteria\n\n_(seeded - edit me)_\n`,
  asset_registry: `# Asset Registry\n\n_(seeded - edit me)_\n`,
  prompt_rules: `# Revision Prompt Rules\n\n_(seeded - edit me)_\n`,
  mistakes_log: `# Mistakes Log\n`,
};

async function seedClient(clientId: string) {
  const root = clientRoot(clientId);
  await ensureDir(root);
  await ensureDir(path.join(clientReferenceRoot(clientId), 'logos'));
  await ensureDir(path.join(clientReferenceRoot(clientId), 'people'));
  await ensureDir(path.join(clientReferenceRoot(clientId), 'brand_examples'));

  const files = clientFiles(clientId);
  for (const [key, file] of Object.entries(files)) {
    if (!(await fileExists(file))) {
      const k = key
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase() as keyof typeof TEMPLATES;
      await fs.writeFile(file, TEMPLATES[k] ?? '', 'utf8');
      console.log('seeded', file);
    } else {
      console.log('kept   ', file);
    }
  }
}

async function seedBatch(clientId: string, batchId: string) {
  const p = batchPaths(clientId, batchId);
  for (const d of [
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
    await ensureDir(d);
  }
  if (!(await fileExists(p.manifest))) {
    await fs.writeFile(
      p.manifest,
      JSON.stringify(
        {
          client_id: clientId,
          batch_id: batchId,
          created_at: new Date().toISOString(),
          created_by: 'seed',
          content_type: 'static_images',
          status: 'open',
          storage_mode: 'local',
          llm_provider: 'openai',
          image_provider: 'prompt_only',
          images: [],
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log('seeded', p.manifest);
  }
  if (!(await fileExists(p.approvalLog))) {
    await fs.writeFile(
      p.approvalLog,
      JSON.stringify({ batch_id: batchId, approvals: [] }, null, 2),
      'utf8',
    );
    console.log('seeded', p.approvalLog);
  }
}

(async () => {
  await seedClient('lenslock');
  await seedBatch('lenslock', 'batch_001');
  console.log('done');
})();
