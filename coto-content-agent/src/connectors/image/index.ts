import type { ImageProvider } from '@/schemas';
import { HiggsfieldStubConnector } from './higgsfieldStub';
import { OpenAIImageConnector } from './openaiImage';
import { PromptOnlyImageConnector } from './promptOnly';
import type { ImageConnector } from './types';

export function imageProvider(provider: ImageProvider): ImageConnector {
  switch (provider) {
    case 'prompt_only':
      return new PromptOnlyImageConnector();
    case 'openai_image':
      return new OpenAIImageConnector();
    case 'higgsfield_stub':
      return new HiggsfieldStubConnector();
  }
}

export type { ImageConnector, ImageEditRequest, ImageEditResult } from './types';
