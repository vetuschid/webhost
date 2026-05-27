import type {
  LlmCallOptions,
  LlmConnector,
  LlmMessage,
  LlmUserPart,
} from './types';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function toContent(content: string | LlmUserPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.dataBase64}` } },
  );
}

export class OpenRouterConnector implements LlmConnector {
  name = 'openrouter';
  defaultModel = DEFAULT_MODEL;

  isReady() {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  async complete(messages: LlmMessage[], opts: LlmCallOptions = {}) {
    if (!this.isReady()) throw new Error('OPENROUTER_API_KEY not set');
    const body = {
      model: opts.model || DEFAULT_MODEL,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1500,
      response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
      messages: messages.map((m) => ({
        role: m.role,
        content:
          m.role === 'user' ? (toContent(m.content) as unknown) : (m.content as string),
      })),
    };
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Coto Content Review Agent',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`OpenRouter error ${r.status}: ${t}`);
    }
    const data = (await r.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
