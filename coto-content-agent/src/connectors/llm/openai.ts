import OpenAI from 'openai';
import type {
  LlmCallOptions,
  LlmConnector,
  LlmMessage,
  LlmUserPart,
} from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';

function toOpenAIContent(content: string | LlmUserPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) => {
    if (p.type === 'text') return { type: 'text' as const, text: p.text };
    return {
      type: 'image_url' as const,
      image_url: { url: `data:${p.mediaType};base64,${p.dataBase64}` },
    };
  });
}

export class OpenAIConnector implements LlmConnector {
  name = 'openai';
  defaultModel = DEFAULT_MODEL;

  isReady() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async complete(messages: LlmMessage[], opts: LlmCallOptions = {}) {
    if (!this.isReady()) {
      throw new Error('OPENAI_API_KEY not set');
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: opts.model || DEFAULT_MODEL,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1500,
      response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
      messages: messages.map((m) => ({
        role: m.role,
        content:
          m.role === 'user'
            ? (toOpenAIContent(m.content) as never)
            : (m.content as string),
      })),
    });
    return resp.choices[0]?.message?.content ?? '';
  }
}
