import { useState } from 'react';

const CANONICAL = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'title',
  'company',
  'domain',
  'linkedin_url',
  'city',
  'state',
  'country',
];

export default function ColumnMapper({
  headers,
  initial,
  onApply,
}: {
  headers: string[];
  initial: Record<string, string>;
  onApply: (m: Record<string, string>) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(initial);
  return (
    <div className="border border-slate-800 rounded p-4 bg-slate-900/40">
      <h3 className="font-semibold mb-2">Column mapping</h3>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="text-left py-1">CSV column</th>
            <th className="text-left py-1">Maps to</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h) => (
            <tr key={h} className="border-t border-slate-800">
              <td className="py-1 pr-3 font-mono text-slate-300">{h}</td>
              <td className="py-1">
                <select
                  value={mapping[h] ?? `extra.${h.toLowerCase().replace(/\s+/g, '_')}`}
                  onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                  className="w-full"
                >
                  {CANONICAL.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={`extra.${h.toLowerCase().replace(/\s+/g, '_')}`}>
                    extra.{h.toLowerCase().replace(/\s+/g, '_')}
                  </option>
                  <option value="">— ignore —</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => onApply(mapping)}
        className="mt-3 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
      >
        Apply mapping
      </button>
    </div>
  );
}
