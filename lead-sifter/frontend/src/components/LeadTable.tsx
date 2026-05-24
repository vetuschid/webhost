import type { LeadResultOut } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  qualified: 'text-emerald-400',
  rejected: 'text-slate-400',
  errored: 'text-rose-400',
  evaluating: 'text-amber-400',
};

export default function LeadTable({
  results,
  selected,
  onToggle,
}: {
  results: LeadResultOut[];
  selected?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  return (
    <div className="border border-slate-800 rounded overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-400">
          <tr>
            {onToggle && <th className="px-2 py-2"></th>}
            <th className="px-2 py-2 text-left">Lead</th>
            <th className="px-2 py-2 text-left">Status</th>
            <th className="px-2 py-2 text-left">Output</th>
            <th className="px-2 py-2 text-left">GHL</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-t border-slate-800">
              {onToggle && (
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selected?.has(r.id) || false}
                    onChange={() => onToggle(r.id)}
                  />
                </td>
              )}
              <td className="px-2 py-2 font-mono text-xs">#{r.lead_id}</td>
              <td className={`px-2 py-2 font-medium ${STATUS_COLOR[r.status] || ''}`}>
                {r.status}
              </td>
              <td className="px-2 py-2 max-w-md truncate">
                <code className="text-xs text-slate-300">{JSON.stringify(r.output)}</code>
              </td>
              <td className="px-2 py-2">
                {r.pushed_to_ghl ? (
                  <span className="text-emerald-400 text-xs">pushed</span>
                ) : r.ghl_result?.error ? (
                  <span className="text-rose-400 text-xs">{String(r.ghl_result.error).slice(0, 40)}</span>
                ) : (
                  <span className="text-slate-500 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={onToggle ? 5 : 4} className="text-center text-slate-500 py-6">
                no results
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
