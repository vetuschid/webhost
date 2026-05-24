export type Provider = 'openai' | 'anthropic';

export interface ApiKeyOut {
  provider: string;
  last4: string;
  updated_at: string;
}

export interface ContextBundleOut {
  id: number;
  name: string;
  sources: string[];
  content_hash: string;
  output_schema: Record<string, unknown>;
  qualified_field: string;
  created_at: string;
  preview?: string;
}

export interface GhlTarget {
  create_contact: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  tags: string[];
  workflow_id: string | null;
}

export interface ApolloFilters {
  person_titles: string[];
  person_locations: string[];
  organization_locations: string[];
  organization_num_employees_ranges: string[];
  q_keywords: string | null;
  per_page: number;
  max_pages: number;
  enrich_emails: boolean;
}

export interface RunOut {
  id: number;
  model: string;
  provider: string;
  bundle_id: number;
  source: string;
  status: string;
  summary: Record<string, number>;
  ghl_target: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
}

export interface LeadResultOut {
  id: number;
  run_id: number;
  lead_id: number;
  status: 'qualified' | 'rejected' | 'errored' | string;
  output: Record<string, unknown>;
  reasoning: string | null;
  error: string | null;
  pushed_to_ghl: boolean;
  ghl_result: Record<string, unknown>;
}

export interface LeadOut {
  id: number;
  run_id: number;
  source: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  domain: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface ChatSession {
  id: number;
  title: string;
  model: string;
  provider: Provider;
  bundle_id: number | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
