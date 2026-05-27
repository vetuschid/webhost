import path from 'node:path';

const ROOT = process.env.LOCAL_DATA_DIR
  ? path.resolve(process.cwd(), process.env.LOCAL_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

export const dataRoot = () => ROOT;
export const clientsRoot = () => path.join(ROOT, 'clients');
export const clientRoot = (clientId: string) => path.join(clientsRoot(), clientId);
export const clientReferenceRoot = (clientId: string) =>
  path.join(clientRoot(clientId), 'reference_assets');
export const batchesRoot = (clientId: string) =>
  path.join(clientRoot(clientId), 'batches');
export const batchRoot = (clientId: string, batchId: string) =>
  path.join(batchesRoot(clientId), batchId);

export const batchPaths = (clientId: string, batchId: string) => {
  const base = batchRoot(clientId, batchId);
  return {
    base,
    manifest: path.join(base, 'batch_manifest.json'),
    chat: path.join(base, 'batch_chat.md'),
    approvalLog: path.join(base, 'approval_log.json'),
    originals: path.join(base, 'originals'),
    humanFeedback: path.join(base, 'human_feedback'),
    aiReviews: path.join(base, 'ai_reviews'),
    clarifyingQuestions: path.join(base, 'clarifying_questions'),
    revisionPrompts: path.join(base, 'revision_prompts'),
    generatedOutputs: path.join(base, 'generated_outputs'),
    qaReviews: path.join(base, 'qa_reviews'),
    approved: path.join(base, 'approved'),
    rejected: path.join(base, 'rejected'),
    logs: path.join(base, 'logs'),
  };
};

export const clientFiles = (clientId: string) => {
  const base = clientRoot(clientId);
  return {
    brandRules: path.join(base, 'brand_rules.md'),
    reviewCriteria: path.join(base, 'review_criteria.md'),
    assetRegistry: path.join(base, 'asset_registry.md'),
    promptRules: path.join(base, 'prompt_rules.md'),
    mistakesLog: path.join(base, 'mistakes_log.md'),
  };
};
