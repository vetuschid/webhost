import type { ImageProvider, LlmProvider } from '@/schemas';

const isLlmProvider = (v: string | undefined): v is LlmProvider =>
  v === 'openai' || v === 'anthropic' || v === 'openrouter';

const isImageProvider = (v: string | undefined): v is ImageProvider =>
  v === 'prompt_only' || v === 'openai_image' || v === 'higgsfield_stub';

export function defaultLlmProvider(): LlmProvider {
  const v = process.env.DEFAULT_LLM_PROVIDER;
  return isLlmProvider(v) ? v : 'openai';
}

export function defaultImageProvider(): ImageProvider {
  const v = process.env.DEFAULT_IMAGE_PROVIDER;
  return isImageProvider(v) ? v : 'prompt_only';
}

export function activeUser() {
  return {
    role: (process.env.ACTIVE_USER || 'content_manager') as
      | 'admin'
      | 'approver_1'
      | 'approver_2'
      | 'content_manager'
      | 'client_approver',
    name: process.env.ACTIVE_USER_NAME || 'Coto Content Manager',
  };
}

export const connectorReadiness = () => ({
  local_storage: true,
  openai: Boolean(process.env.OPENAI_API_KEY),
  anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  openai_image: Boolean(process.env.OPENAI_API_KEY),
  higgsfield: Boolean(process.env.HIGGSFIELD_API_KEY),
  slack: Boolean(process.env.SLACK_WEBHOOK_URL),
  google_drive: Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  ),
  email: false,
  gohighlevel: Boolean(process.env.GHL_API_KEY),
  dropbox: Boolean(process.env.DROPBOX_ACCESS_TOKEN),
});
