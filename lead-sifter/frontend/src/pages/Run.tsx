import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ModelPicker from '@/components/ModelPicker';
import ContextPicker from '@/components/ContextPicker';
import ApolloSearchForm from '@/components/ApolloSearchForm';
import CsvUploader from '@/components/CsvUploader';
import GhlTargetPicker from '@/components/GhlTargetPicker';
import LeadTable from '@/components/LeadTable';
import { api } from '@/lib/api';
import type { ApolloFilters, GhlTarget, LeadResultOut, Provider } from '@/lib/types';

const EMPTY_APOLLO: ApolloFilters = {
  person_titles: [],
  person_locations: [],
  organization_locations: [],
  organization_num_employees_ranges: [],
  q_keywords: null,
  per_page: 100,
  max_pages: 5,
  enrich_emails: false,
};

const EMPTY_GHL: GhlTarget = {
  create_contact: true,
  pipeline_id: null,
  stage_id: null,
  tags: [],
  workflow_id: null,
};

export default function Run() {
  const nav = useNavigate();
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [model, setModel] = useState('');
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [tab, setTab] = useState<'apollo' | 'csv'>('apollo');
  const [apollo, setApollo] = useState<ApolloFilters>(EMPTY_APOLLO);
  const [ghl, setGhl] = useState<GhlTarget>(EMPTY_GHL);
  const [parallel, setParallel] = useState(5);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [showEnrichConfirm, setShowEnrichConfirm] = useState(false);

  const [liveResults, setLiveResults] = useState<LeadResultOut[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const startApollo = useMutation({
    mutationFn: async () => {
      const r = await api.createRun({
        model,
        provider,
        bundle_id: bundleId!,
        max_parallel: parallel,
        streaming: true,
        source: 'apollo',
        apollo,
        ghl_target: ghl,
      });
      return r;
    },
    onSuccess: (r) => beginStream(r.id),
  });

  const startCsv = useMutation({
    mutationFn: async () => {
      if (!csvFile) throw new Error('no file');
      return api.createRunFromCsv({
        model,
        provider,
        bundle_id: bundleId!,
        max_parallel: parallel,
        streaming: true,
        mapping: csvMapping,
        ghl_target: ghl,
        file: csvFile,
      });
    },
    onSuccess: (r) => beginStream(r.id),
  });

  const beginStream = (id: number) => {
    setRunId(id);
    setLiveResults([]);
    setSummary(null);
    api.streamRun(id, (e) => {
      if (e.event === 'lead' && e.status !== 'evaluating') {
        setLiveResults((arr) => [
          ...arr,
          {
            id: (e.lead_result_id as number) ?? Math.random(),
            run_id: id,
            lead_id: e.lead_id as number,
            status: e.status as LeadResultOut['status'],
            output: (e.output as Record<string, unknown>) || {},
            reasoning: null,
            error: (e.error as string) || null,
            pushed_to_ghl: false,
            ghl_result: (e.ghl as Record<string, unknown>) || {},
          },
        ]);
      } else if (e.event === 'summary') {
        setSummary(e as unknown as Record<string, number>);
      }
    });
  };

  const start = () => {
    if (apollo.enrich_emails && tab === 'apollo') {
      setShowEnrichConfirm(true);
      return;
    }
    if (tab === 'apollo') startApollo.mutate();
    else startCsv.mutate();
  };

  const confirmEnrich = () => {
    setShowEnrichConfirm(false);
    startApollo.mutate();
  };

  const canStart = model && bundleId && (tab === 'apollo' || (csvFile && Object.keys(csvMapping).length > 0));

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">New run</h1>

      <Section title="1. Model + context">
        <ModelPicker
          provider={provider}
          value={model}
          onChange={setModel}
          onProviderChange={setProvider}
        />
        <ContextPicker value={bundleId} onChange={setBundleId} />
      </Section>

      <Section title="2. Lead source">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('apollo')}
            className={`px-3 py-1 rounded ${tab === 'apollo' ? 'bg-slate-700' : 'bg-slate-900'}`}
          >
            Apollo search
          </button>
          <button
            onClick={() => setTab('csv')}
            className={`px-3 py-1 rounded ${tab === 'csv' ? 'bg-slate-700' : 'bg-slate-900'}`}
          >
            CSV upload
          </button>
        </div>
        {tab === 'apollo' ? (
          <ApolloSearchForm value={apollo} onChange={setApollo} />
        ) : (
          <CsvUploader
            onReady={(f, m) => {
              setCsvFile(f);
              setCsvMapping(m);
            }}
          />
        )}
      </Section>

      <Section title="3. GHL target">
        <GhlTargetPicker value={ghl} onChange={setGhl} />
      </Section>

      <Section title="4. Concurrency">
        <label className="flex items-center gap-2 text-sm">
          Max parallel LLM calls:
          <input
            type="number"
            min={1}
            max={20}
            value={parallel}
            onChange={(e) => setParallel(Math.min(20, Math.max(1, Number(e.target.value))))}
            className="w-20"
          />
        </label>
      </Section>

      <div className="flex gap-3 items-center">
        <button
          disabled={!canStart || startApollo.isPending || startCsv.isPending}
          onClick={start}
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
        >
          Start run
        </button>
        {(startApollo.error || startCsv.error) && (
          <div className="text-rose-400 text-xs">
            {String(startApollo.error || startCsv.error)}
          </div>
        )}
      </div>

      {showEnrichConfirm && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded p-4 space-y-2">
          <div className="font-semibold">Confirm Apollo enrichment</div>
          <div className="text-sm text-slate-300">
            Email enrichment uses ~1 credit per matched lead. Up to{' '}
            <b>{apollo.per_page * apollo.max_pages}</b> credits will be consumed.
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmEnrich}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black"
            >
              Confirm & run
            </button>
            <button
              onClick={() => setShowEnrichConfirm(false)}
              className="px-3 py-1.5 rounded bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {runId && (
        <Section title={`Live results · run #${runId}`}>
          <LeadTable results={liveResults} />
          {summary && (
            <div className="text-sm text-slate-300 mt-2">
              <b>Summary:</b> {summary.total} evaluated · {summary.qualified} qualified ·{' '}
              {summary.rejected} rejected · {summary.errored} errored ·{' '}
              {summary.pushed_to_ghl} pushed to GHL ({summary.ghl_push_failed} failed)
              <button
                className="ml-3 underline text-emerald-400"
                onClick={() => nav(`/history/${runId}`)}
              >
                Open in history →
              </button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/30 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}
