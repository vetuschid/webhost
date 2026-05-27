import type { LlmProvider } from '@/schemas';
import { AnthropicConnector } from './anthropic';
import { OpenAIConnector } from './openai';
import { OpenRouterConnector } from './openrouter';
import type { LlmConnector } from './types';

export function llm(provider: LlmProvider): LlmConnector {
  switch (provider) {
    case 'openai':
      return new OpenAIConnector();
    case 'anthropic':
      return new AnthropicConnector();
    case 'openrouter':
      return new OpenRouterConnector();
  }
}

export type { LlmConnector, LlmMessage, LlmUserPart } from './types';
