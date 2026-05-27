export interface ImageEditRequest {
  // Markdown prompt body that was authored by the Revision Prompt Agent.
  prompt: string;
  // Absolute path to the source image on disk.
  sourcePath: string;
  // Absolute path where we expect the generated output to land.
  outputPath: string;
  // Optional target size hint. If absent we ask the provider to preserve aspect.
  size?: string;
}

export interface ImageEditResult {
  ok: boolean;
  outputPath?: string;
  // 'skipped' means the provider intentionally did not call any API
  // (prompt_only / stubs). 'error' means a real attempt failed.
  reason?: 'skipped' | 'error';
  message?: string;
  providerPayloadPath?: string;
}

export interface ImageConnector {
  name: string;
  isReady(): boolean;
  edit(req: ImageEditRequest): Promise<ImageEditResult>;
}
