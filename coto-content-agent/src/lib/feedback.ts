import path from 'node:path';
import type { FeedbackEntry } from '@/schemas';
import { appendJsonl, readText, writeText } from '@/utils/fsio';
import { nowIso } from '@/utils/ids';
import { batchPaths } from '@/utils/paths';

const FEEDBACK_LOG = 'feedback.jsonl';

export async function appendFeedback(
  clientId: string,
  batchId: string,
  entry: Omit<FeedbackEntry, 'timestamp'>,
) {
  const full: FeedbackEntry = { ...entry, timestamp: nowIso() };
  const paths = batchPaths(clientId, batchId);

  await appendJsonl(path.join(paths.humanFeedback, FEEDBACK_LOG), full);

  const chatPath = paths.chat;
  const existing = await readText(chatPath);
  const header = entry.scope === 'batch' ? '## Batch feedback' : `## Feedback on ${entry.image_id}`;
  const block = `\n### [${full.timestamp}] ${entry.user}\n${header}\n\n${entry.text}\n`;
  await writeText(
    chatPath,
    existing ? existing.trimEnd() + '\n' + block : `# Batch ${batchId} chat\n${block}`,
  );

  if (entry.image_id) {
    const perImage = path.join(paths.humanFeedback, `${entry.image_id}_feedback.md`);
    const cur = await readText(perImage);
    await writeText(
      perImage,
      (cur ? cur.trimEnd() + '\n' : `# Feedback — ${entry.image_id}\n`) + `\n- [${full.timestamp}] ${entry.user}: ${entry.text}\n`,
    );
  }

  return full;
}

export async function readFeedbackLog(
  clientId: string,
  batchId: string,
): Promise<FeedbackEntry[]> {
  const file = path.join(batchPaths(clientId, batchId).humanFeedback, FEEDBACK_LOG);
  const raw = await readText(file);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as FeedbackEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is FeedbackEntry => x !== null);
}

export async function feedbackForImage(
  clientId: string,
  batchId: string,
  imageId: string,
): Promise<string> {
  const log = await readFeedbackLog(clientId, batchId);
  const lines: string[] = [];
  for (const e of log) {
    if (e.scope === 'batch') {
      // Try to detect "Slide N:" style mapping
      const mapped = parseBatchSlideFeedback(e.text, imageId);
      if (mapped) lines.push(`(batch) ${mapped}`);
    } else if (e.image_id === imageId) {
      lines.push(e.text);
    }
  }
  return lines.join('\n\n');
}

const SLIDE_LINE = /^\s*(?:slide|post|image)\s*0*(\d{1,3})\s*[:\-]\s*(.+)$/i;

export function parseBatchSlideFeedback(text: string, imageId: string): string | null {
  const m = /^slide_(\d{3})$/.exec(imageId);
  if (!m) return null;
  const target = parseInt(m[1], 10);
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const r = SLIDE_LINE.exec(line);
    if (r) {
      const n = parseInt(r[1], 10);
      if (n === target) return r[2].trim();
    }
  }
  return null;
}
