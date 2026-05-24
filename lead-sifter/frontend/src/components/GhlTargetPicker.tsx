import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { GhlTarget } from '@/lib/types';

export default function GhlTargetPicker({
  value,
  onChange,
}: {
  value: GhlTarget;
  onChange: (v: GhlTarget) => void;
}) {
  const pipelines = useQuery({ queryKey: ['ghl-pipelines'], queryFn: api.ghlPipelines });
  const tags = useQuery({ queryKey: ['ghl-tags'], queryFn: api.ghlTags });
  const workflows = useQuery({ queryKey: ['ghl-workflows'], queryFn: api.ghlWorkflows });
  const toolMap = useQuery({ queryKey: ['ghl-toolmap'], queryFn: () => api.ghlToolMap(false) });

  const [pipeline, setPipeline] = useState<string | null>(value.pipeline_id);
  const stages =
    pipelines.data?.find((p) => p.id === pipeline)?.stages ?? [];

  useEffect(() => {
    onChange({ ...value, pipeline_id: pipeline });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline]);

  return (
    <div className="space-y-3 max-w-2xl">
      {toolMap.data && (
        <div className="text-xs text-slate-400">
          Discovered tools:{' '}
          <code className="bg-slate-800 px-1 rounded">{toolMap.data.upsert_contact || '—'}</code>{' '}
          ·{' '}
          <code className="bg-slate-800 px-1 rounded">
            {toolMap.data.create_opportunity || '—'}
          </code>{' '}
          · <code className="bg-slate-800 px-1 rounded">{toolMap.data.add_tags || '—'}</code> ·{' '}
          <code className="bg-slate-800 px-1 rounded">{toolMap.data.add_to_workflow || '—'}</code>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.create_contact}
          onChange={(e) => onChange({ ...value, create_contact: e.target.checked })}
        />
        Create / upsert contact for every qualified lead
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase text-slate-400 mb-1">Pipeline</div>
          <select value={pipeline ?? ''} onChange={(e) => setPipeline(e.target.value || null)} className="w-full">
            <option value="">— none —</option>
            {pipelines.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400 mb-1">Stage</div>
          <select
            value={value.stage_id ?? ''}
            onChange={(e) => onChange({ ...value, stage_id: e.target.value || null })}
            className="w-full"
            disabled={!pipeline}
          >
            <option value="">— none —</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase text-slate-400 mb-1">Tags</div>
        <input
          placeholder="comma-separated"
          value={value.tags.join(', ')}
          onChange={(e) =>
            onChange({
              ...value,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="w-full"
        />
        {tags.data && tags.data.length > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            existing: {tags.data.slice(0, 12).map((t) => t.name).join(', ')}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase text-slate-400 mb-1">Workflow</div>
        <select
          value={value.workflow_id ?? ''}
          onChange={(e) => onChange({ ...value, workflow_id: e.target.value || null })}
          className="w-full"
        >
          <option value="">— none —</option>
          {workflows.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
