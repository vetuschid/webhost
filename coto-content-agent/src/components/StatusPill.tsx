import type { ApprovalStatus, ImageStatus } from '@/schemas';

const GOOD = new Set<ImageStatus>(['qa_passed', 'approved', 'delivered']);
const BAD = new Set<ImageStatus>(['qa_failed', 'rejected', 'needs_human_review']);

export function StatusPill({
  status,
  approval,
}: {
  status: ImageStatus;
  approval?: ApprovalStatus;
}) {
  const cls = GOOD.has(status)
    ? 'pill-ok'
    : BAD.has(status)
    ? 'pill-bad'
    : 'pill-warn';
  return (
    <span className="inline-flex gap-1">
      <span className={cls}>{status}</span>
      {approval ? (
        <span
          className={
            approval === 'approved'
              ? 'pill-ok'
              : approval === 'rejected'
              ? 'pill-bad'
              : 'pill-warn'
          }
        >
          {approval}
        </span>
      ) : null}
    </span>
  );
}
