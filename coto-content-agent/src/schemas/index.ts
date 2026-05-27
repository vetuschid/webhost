import { z } from 'zod';

// ---------- Status enums ----------
// One canonical list. Used by manifest, dashboard, and agents.
export const ImageStatus = z.enum([
  'uploaded',
  'ai_reviewed',
  'awaiting_human_feedback',
  'clarification_needed',
  'clarification_answered',
  'revision_prompt_created',
  'regeneration_pending',
  'regenerated',
  'qa_passed',
  'qa_failed',
  'retry_generated',
  'needs_human_review',
  'approved',
  'rejected',
  'delivered',
]);
export type ImageStatus = z.infer<typeof ImageStatus>;

export const ApprovalStatus = z.enum([
  '',
  'pending',
  'approved',
  'rejected',
  'needs_revision',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const Role = z.enum([
  'admin',
  'approver_1',
  'approver_2',
  'content_manager',
  'client_approver',
]);
export type Role = z.infer<typeof Role>;

export const LlmProvider = z.enum(['openai', 'anthropic', 'openrouter']);
export type LlmProvider = z.infer<typeof LlmProvider>;

export const ImageProvider = z.enum([
  'prompt_only',
  'openai_image',
  'higgsfield_stub',
]);
export type ImageProvider = z.infer<typeof ImageProvider>;

// ---------- Batch manifest ----------
export const BatchImage = z.object({
  image_id: z.string(),
  original_filename: z.string(),
  normalized_filename: z.string(),
  status: ImageStatus,
  current_output_path: z.string().default(''),
  approval_status: ApprovalStatus.default(''),
  retry_count: z.number().int().nonnegative().default(0),
  prompt_version: z.number().int().nonnegative().default(0),
  output_version: z.number().int().nonnegative().default(0),
  qa_version: z.number().int().nonnegative().default(0),
  last_qa_verdict: z.enum(['pass', 'fail', 'uncertain', '']).default(''),
});
export type BatchImage = z.infer<typeof BatchImage>;

export const BatchManifest = z.object({
  client_id: z.string(),
  batch_id: z.string(),
  created_at: z.string(),
  created_by: z.string(),
  content_type: z.string().default('static_images'),
  status: z.string().default('open'),
  storage_mode: z.enum(['local', 'gdrive', 'dropbox']).default('local'),
  llm_provider: LlmProvider,
  image_provider: ImageProvider,
  images: z.array(BatchImage).default([]),
});
export type BatchManifest = z.infer<typeof BatchManifest>;

// ---------- Approval log ----------
export const ApprovalEntry = z.object({
  image_id: z.string(),
  status: z.enum(['approved', 'rejected', 'needs_revision']),
  approved_by: z.string(),
  role: Role,
  timestamp: z.string(),
  approved_file_path: z.string().default(''),
  notes: z.string().default(''),
});
export type ApprovalEntry = z.infer<typeof ApprovalEntry>;

export const ApprovalLog = z.object({
  batch_id: z.string(),
  approvals: z.array(ApprovalEntry).default([]),
});
export type ApprovalLog = z.infer<typeof ApprovalLog>;

// ---------- Agent events (jsonl) ----------
export const AgentEvent = z.object({
  timestamp: z.string(),
  user: z.string(),
  agent: z.string(),
  batch_id: z.string(),
  image_id: z.string().optional(),
  action: z.string(),
  prompt_used: z.string().optional(),
  model_used: z.string().optional(),
  provider_used: z.string().optional(),
  result: z.string().optional(),
  qa_result: z.string().optional(),
  failure_reason: z.string().optional(),
  retry_count: z.number().optional(),
  final_status: z.string().optional(),
  notes: z.string().optional(),
});
export type AgentEvent = z.infer<typeof AgentEvent>;

// ---------- Client config (loaded from markdown folder) ----------
export const ClientConfig = z.object({
  client_id: z.string(),
  display_name: z.string(),
  brand_rules: z.string(),
  review_criteria: z.string(),
  asset_registry: z.string(),
  prompt_rules: z.string(),
  mistakes_log: z.string(),
  reference_assets: z.object({
    logos: z.array(z.string()).default([]),
    people: z.array(z.string()).default([]),
    brand_examples: z.array(z.string()).default([]),
  }),
});
export type ClientConfig = z.infer<typeof ClientConfig>;

// ---------- Review / clarification / prompt outputs ----------
export const ReviewOutput = z.object({
  image_id: z.string(),
  source_file: z.string(),
  detected_text: z.string().optional(),
  visible_design_summary: z.string(),
  issues: z.array(z.string()),
  risks: z.array(z.string()),
  status: z.enum(['clean', 'issues', 'needs_clarification']),
  recommended_next_action: z.string(),
  questions_needed: z.array(z.string()).default([]),
});
export type ReviewOutput = z.infer<typeof ReviewOutput>;

export const ClarificationOutput = z.object({
  image_id: z.string(),
  questions: z.array(z.string()),
});
export type ClarificationOutput = z.infer<typeof ClarificationOutput>;

export const RevisionPrompt = z.object({
  image_id: z.string(),
  source_image_filename: z.string(),
  target_output_filename: z.string(),
  prompt_markdown: z.string(),
  version: z.number().int().nonnegative(),
});
export type RevisionPrompt = z.infer<typeof RevisionPrompt>;

export const QaOutput = z.object({
  image_id: z.string(),
  source_image_filename: z.string(),
  output_image_filename: z.string(),
  prompt_used_path: z.string(),
  verdict: z.enum(['pass', 'fail', 'uncertain']),
  reasoning: z.string(),
  improved_prompt: z.string().optional(),
  version: z.number().int().nonnegative(),
});
export type QaOutput = z.infer<typeof QaOutput>;

// ---------- Feedback / chat ----------
export const FeedbackEntry = z.object({
  timestamp: z.string(),
  user: z.string(),
  scope: z.enum(['batch', 'image']),
  image_id: z.string().optional(),
  text: z.string(),
});
export type FeedbackEntry = z.infer<typeof FeedbackEntry>;
