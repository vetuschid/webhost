import path from 'node:path';
import type { AgentEvent } from '@/schemas';
import { appendJsonl, readText, writeText } from '@/utils/fsio';
import { nowIso } from '@/utils/ids';
import { batchPaths, clientFiles } from '@/utils/paths';

// Logging Agent: single source of truth for all agent-action events.
// Writes:
//   - jsonl event stream per batch (machine readable)
//   - markdown summary appended per batch (human readable)
//   - client-level mistakes_log.md (so future agents learn patterns)

export async function logEvent(
  clientId: string,
  batchId: string,
  event: Omit<AgentEvent, 'timestamp' | 'batch_id'>,
) {
  const paths = batchPaths(clientId, batchId);
  const full: AgentEvent = {
    timestamp: nowIso(),
    batch_id: batchId,
    ...event,
  };
  await appendJsonl(path.join(paths.logs, 'agent_events.jsonl'), full);

  const summaryPath = path.join(paths.logs, 'batch_summary.md');
  const existing = await readText(summaryPath);
  const line = `- [${full.timestamp}] ${full.agent} \`${full.action}\`${full.image_id ? ' on `' + full.image_id + '`' : ''}${full.result ? ' — ' + full.result : ''}`;
  await writeText(
    summaryPath,
    existing
      ? `${existing.trimEnd()}\n${line}\n`
      : `# Batch ${batchId} log\n\n${line}\n`,
  );
}

export async function appendMistake(clientId: string, note: string) {
  const file = clientFiles(clientId).mistakesLog;
  const existing = await readText(file);
  const entry = `\n- [${nowIso()}] ${note}`;
  await writeText(file, (existing || '# Mistakes Log\n').trimEnd() + entry + '\n');
}
