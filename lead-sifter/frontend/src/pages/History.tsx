import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import LeadTable from '@/components/LeadTable';
import GhlTargetPicker from '@/components/GhlTargetPicker';
import { api } from '@/lib/api';
import type { GhlTarget } from '@/lib/types';

export default function History() {
  const qc = useQueryClient();
  const params = useParams();
  const initial = params.id ? Number(params.id) : null;
  const [active, setActive] = useState<number | null>(initial);
  const { data: runs = [] } = useQuery({ queryKey: ['runs'], queryFn: api.listRuns });
  const { data: run } = useQuery({
    queryKey: ['run', active],
    queryFn: () => api.getRun(active!),
    enabled: !!active,
  });
  const { data: results = [] } = useQuery({
    queryKey: ['run-results', active],
    queryFn: () => api.getRunResults(active!),
    enabled: !!active,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pushTarget, setPushTarget] = useState<GhlTarget>({
    create_contact: true,
    pipeline_id: null,
    stage_id: null,
    tags: [],
    workflow_id: null,
  });

  const push = useMutation({
    mutationFn: () => api.ghlPushSelection(Array.from(selected), pushTarget),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run-results', active] }),
  });

  return (
    <div className="flex gap-6 max-w-7xl">
      <div className="w-64 space-y-1 shrink-0">
        <h2 className="font-semibold mb-2">Runs</h2>
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r.id)}
            className={`block w-full text-left px-2 py-1 rounded text-sm ${
              active === r.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
            }`}
          >
            #{r.id} · {r.model}
            <div className="text-xs text-slate-500">
              {new Date(r.created_at).toLocaleString()} · {r.status}
            </div>
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4">
        {!active && <div className="text-slate-500">Select a run.</div>}
        {run && (
          <>
            <div className="border border-slate-800 rounded p-4 bg-slate-900/30">
              <div className="font-semibold mb-1">Run #{run.id}</div>
              <div className="text-xs text-slate-400">
                model: {run.model} · provider: {run.provider} · source: {run.source} · status:{' '}
                {run.status}
              </div>
              {run.summary && Object.keys(run.summary).length > 0 && (
                <div className="text-sm mt-2 text-slate-300">
                  total {run.summary.total} · qualified {run.summary.qualified} · rejected{' '}
                  {run.summary.rejected} · errored {run.summary.errored} · pushed{' '}
                  {run.summary.pushed_to_ghl}
                </div>
              )}
            </div>

            <div className="border border-slate-800 rounded p-4 bg-slate-900/30 space-y-3">
              <div className="font-semibold">Re-push selection to GHL</div>
              <GhlTargetPicker value={pushTarget} onChange={setPushTarget} />
              <button
                disabled={selected.size === 0 || push.isPending}
                onClick={() => push.mutate()}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
              >
                Push {selected.size} selected
              </button>
            </div>

            <LeadTable
              results={results}
              selected={selected}
              onToggle={(id) =>
                setSelected((s) => {
                  const next = new Set(s);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
