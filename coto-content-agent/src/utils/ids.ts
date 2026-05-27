// Deterministic id + filename helpers. No randomness so a batch can be
// re-run and diffed cleanly.

export const imageIdFromIndex = (index: number) =>
  `slide_${String(index).padStart(3, '0')}`;

export const normalizedOriginal = (batchId: string, imageId: string, ext: string) =>
  `${batchId}_${imageId}_original${ext}`;

export const promptFilename = (batchId: string, imageId: string, version: number) =>
  `${batchId}_${imageId}_prompt_v${version}.md`;

export const outputFilename = (batchId: string, imageId: string, version: number, ext: string) =>
  `${batchId}_${imageId}_output_v${version}${ext}`;

export const qaFilename = (batchId: string, imageId: string, version: number) =>
  `${batchId}_${imageId}_qa_v${version}.md`;

export const finalFilename = (batchId: string, imageId: string, ext: string) =>
  `${batchId}_${imageId}_final${ext}`;

export const reviewFilename = (imageId: string, version: number) =>
  `${imageId}_review_v${version}.md`;

export const questionsFilename = (imageId: string, version: number) =>
  `${imageId}_questions_v${version}.md`;

export const nowIso = () => new Date().toISOString();

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
