import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import ColumnMapper from './ColumnMapper';

export default function CsvUploader({
  onReady,
}: {
  onReady: (file: File, mapping: Record<string, string>) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [guess, setGuess] = useState<Record<string, string>>({});
  const [rows, setRows] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    onDrop: async ([f]) => {
      setFile(f);
      setErr(null);
      try {
        const r = await api.csvPreview(f);
        setHeaders(r.headers);
        setGuess(r.guessed_mapping);
        setRows(r.rows);
      } catch (e) {
        setErr(String(e));
      }
    },
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded p-8 text-center text-sm ${
          isDragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <div className="font-medium">{file.name}</div>
            <div className="text-xs text-slate-400">{rows} rows · {headers.length} columns</div>
          </div>
        ) : (
          <div className="text-slate-400">Drop a CSV file here or click to choose.</div>
        )}
      </div>
      {err && <div className="text-rose-400 text-xs">{err}</div>}
      {headers.length > 0 && (
        <ColumnMapper
          headers={headers}
          initial={guess}
          onApply={(mapping) => onReady(file!, mapping)}
        />
      )}
    </div>
  );
}
