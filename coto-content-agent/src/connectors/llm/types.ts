export type LlmMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | LlmUserPart[] }
  | { role: 'assistant'; content: string };

export type LlmUserPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; dataBase64: string };

export interface LlmCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmConnector {
  name: string;
  defaultModel: string;
  isReady(): boolean;
  complete(messages: LlmMessage[], opts?: LlmCallOptions): Promise<string>;
}
