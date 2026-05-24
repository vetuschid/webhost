import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ModelPicker from '@/components/ModelPicker';
import ContextPicker from '@/components/ContextPicker';
import StreamingChat from '@/components/StreamingChat';
import { api } from '@/lib/api';
import type { Provider } from '@/lib/types';

export default function Chat() {
  const qc = useQueryClient();
  const { data: sessions = [] } = useQuery({ queryKey: ['chats'], queryFn: api.listChats });
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [model, setModel] = useState('');
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', active],
    queryFn: () => api.listChatMessages(active!),
    enabled: !!active,
  });

  const create = useMutation({
    mutationFn: () => api.createChat({ provider, model, bundle_id: bundleId }),
    onSuccess: (s) => {
      setActive(s.id);
      qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  useEffect(() => {
    if (!active && sessions[0]) setActive(sessions[0].id);
  }, [sessions, active]);

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      <div className="w-64 flex flex-col gap-2 shrink-0">
        <h2 className="font-semibold mb-1">New chat</h2>
        <ModelPicker
          provider={provider}
          value={model}
          onChange={setModel}
          onProviderChange={setProvider}
        />
        <ContextPicker value={bundleId} onChange={setBundleId} allowNone />
        <button
          disabled={!model || create.isPending}
          onClick={() => create.mutate()}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
        >
          Start chat
        </button>
        <div className="mt-4 text-xs uppercase text-slate-500">Sessions</div>
        <div className="flex flex-col gap-1 overflow-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`text-left px-2 py-1 rounded text-sm ${
                active === s.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
              }`}
            >
              {s.title} <span className="text-xs text-slate-500">· {s.model}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {active ? (
          <StreamingChat sessionId={active} initialMessages={messages} />
        ) : (
          <div className="text-slate-500">Start a chat to begin.</div>
        )}
      </div>
    </div>
  );
}
