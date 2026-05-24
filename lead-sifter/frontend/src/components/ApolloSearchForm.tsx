import { useState } from 'react';
import type { ApolloFilters } from '@/lib/types';

const empty: ApolloFilters = {
  person_titles: [],
  person_locations: [],
  organization_locations: [],
  organization_num_employees_ranges: [],
  q_keywords: null,
  per_page: 100,
  max_pages: 5,
  enrich_emails: false,
};

const split = (s: string): string[] =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function ApolloSearchForm({
  value,
  onChange,
}: {
  value: ApolloFilters;
  onChange: (v: ApolloFilters) => void;
}) {
  const [v, setV] = useState<ApolloFilters>(value || empty);
  const upd = (patch: Partial<ApolloFilters>) => {
    const next = { ...v, ...patch };
    setV(next);
    onChange(next);
  };
  return (
    <div className="space-y-3 max-w-2xl">
      <Label name="Job titles (comma or newline-separated)">
        <textarea
          rows={2}
          onChange={(e) => upd({ person_titles: split(e.target.value) })}
          placeholder="VP RevOps, Head of Revenue Operations"
          className="w-full"
        />
      </Label>
      <Label name="Person locations">
        <textarea
          rows={2}
          onChange={(e) => upd({ person_locations: split(e.target.value) })}
          placeholder="United States, Canada"
          className="w-full"
        />
      </Label>
      <Label name="Org locations">
        <textarea
          rows={2}
          onChange={(e) => upd({ organization_locations: split(e.target.value) })}
          placeholder="United States"
          className="w-full"
        />
      </Label>
      <Label name="Employee ranges">
        <input
          onChange={(e) => upd({ organization_num_employees_ranges: split(e.target.value) })}
          placeholder='51,200 / 201,500 (Apollo bucket strings)'
          className="w-full"
        />
      </Label>
      <Label name="Keywords">
        <input
          onChange={(e) => upd({ q_keywords: e.target.value || null })}
          placeholder="healthcare software"
          className="w-full"
        />
      </Label>
      <div className="grid grid-cols-3 gap-3">
        <Label name="Per page (≤100)">
          <input
            type="number"
            min={1}
            max={100}
            value={v.per_page}
            onChange={(e) => upd({ per_page: Number(e.target.value) })}
            className="w-full"
          />
        </Label>
        <Label name="Max pages">
          <input
            type="number"
            min={1}
            max={500}
            value={v.max_pages}
            onChange={(e) => upd({ max_pages: Number(e.target.value) })}
            className="w-full"
          />
        </Label>
        <Label name="Enrich emails (costs Apollo credits)">
          <input
            type="checkbox"
            checked={v.enrich_emails}
            onChange={(e) => upd({ enrich_emails: e.target.checked })}
          />
        </Label>
      </div>
      {v.enrich_emails && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2 rounded">
          Enrichment costs ~1 Apollo credit per matched lead. Up to {v.per_page * v.max_pages}{' '}
          credits for this run.
        </div>
      )}
    </div>
  );
}

function Label({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase text-slate-400 mb-1">{name}</div>
      {children}
    </label>
  );
}
