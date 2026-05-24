import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function Context() {
  const qc = useQueryClient();
  const { data: bundles = [] } = useQuery({ queryKey: ['bundles'], queryFn: api.listBundles });
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [qfield, setQfield] = useState('qualified');
  const [files, setFiles] = useState<File[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setFiles(accepted),
    accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'], 'application/json': ['.json'] },
  });

  const createFolder = useMutation({
    mutationFn: () => api.createBundleFromFolder(name, folder, qfield || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] });
      setName('');
      setFolder('');
    },
  });
  const createUpload = useMutation({
    mutationFn: () => api.uploadBundleFiles(name, files, qfield || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bundles'] });
      setName('');
      setFiles([]);
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => api.deleteBundle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  });

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Context bundles</h1>
        <p className="text-slate-400 text-sm">
          Each bundle is markdown / text loaded into the system prompt. Include a fenced JSON
          block under <code>## Output Schema</code> to enforce structured output. Optional
          frontmatter <code>qualified_field: my_field</code> changes the qualified flag.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 space-y-3">
          <h2 className="font-semibold">From folder path</h2>
          <input
            placeholder="bundle name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
          <input
            placeholder="/absolute/path/to/icp-docs"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="w-full"
          />
          <input
            placeholder="qualified_field (default: qualified)"
            value={qfield}
            onChange={(e) => setQfield(e.target.value)}
            className="w-full"
          />
          <button
            disabled={!name || !folder || createFolder.isPending}
            onClick={() => createFolder.mutate()}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
          >
            Load folder
          </button>
          {createFolder.error && (
            <div className="text-xs text-rose-400">{String(createFolder.error)}</div>
          )}
        </div>

        <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 space-y-3">
          <h2 className="font-semibold">Upload files</h2>
          <input
            placeholder="bundle name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
          <input
            placeholder="qualified_field"
            value={qfield}
            onChange={(e) => setQfield(e.target.value)}
            className="w-full"
          />
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded p-6 text-center text-sm ${
              isDragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'
            }`}
          >
            <input {...getInputProps()} />
            {files.length ? (
              <div>{files.length} file(s) selected</div>
            ) : (
              <div className="text-slate-400">Drag .md / .txt / .json here, or click to pick</div>
            )}
          </div>
          <button
            disabled={!name || files.length === 0 || createUpload.isPending}
            onClick={() => createUpload.mutate()}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
          >
            Upload bundle
          </button>
          {createUpload.error && (
            <div className="text-xs text-rose-400">{String(createUpload.error)}</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Saved bundles</h2>
        <div className="space-y-2">
          {bundles.map((b) => (
            <div
              key={b.id}
              className="border border-slate-800 rounded p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-slate-400">
                  qualified field <code>{b.qualified_field}</code> · {b.sources.length} sources ·{' '}
                  {b.output_schema && Object.keys(b.output_schema).length ? 'schema ✓' : 'no schema'}
                </div>
              </div>
              <button
                onClick={() => del.mutate(b.id)}
                className="text-rose-400 hover:text-rose-300 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
          {!bundles.length && (
            <div className="text-slate-500 text-sm">No bundles yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
