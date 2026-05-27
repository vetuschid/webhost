import Anthropic from '@anthropic-ai/sdk';
import type {
  LlmCallOptions,
  LlmConnector,
  LlmMessage,
  LlmUserPart,
} from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

function toAnthropicContent(content: string | LlmUserPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) => {
    if (p.type === 'text') return { type: 'text' as const, text: p.text };
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: p.mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: p.dataBase64,
      },
    };
  });
}

export class AnthropicConnector implements LlmConnector {
  name = 'anthropic';
  defaultModel = DEFAULT_MODEL;

  isReady() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async complete(messages: LlmMessage[], opts: LlmCallOptions = {}) {
    if (!this.isReady()) throw new Error('ANTHROPIC_API_KEY not set');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => (m as { content: string }).content)
      .join('\n\n');

    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content:
          m.role === 'user'
            ? (toAnthropicContent(m.content) as never)
            : (m.content as string),
      }));

    const resp = await client.messages.create({
      model: opts.model || DEFAULT_MODEL,
      system: system || undefined,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.2,
      messages: turns as never,
    });

    const text = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('\n')
      .trim();
    return text;
  }
}
