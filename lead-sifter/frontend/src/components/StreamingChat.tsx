import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/lib/types';
import { api } from '@/lib/api';

export default function StreamingChat({
  sessionId,
  initialMessages,
}: {
  sessionId: number;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  const send = async () => {
    if (!draft.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: draft,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    const content = draft;
    setDraft('');
    setPending('');
    if (streaming) {
      api.streamChat(sessionId, content, (e) => {
        if (e.event === 'delta') {
          setPending((p) => (p ?? '') + (e.content as string));
        } else if (e.event === 'done') {
          const full = e.content as string;
          setMessages((m) => [
            ...m,
            {
              id: Date.now() + 1,
              role: 'assistant',
              content: full,
              created_at: new Date().toISOString(),
            },
          ]);
          setPending(null);
        }
      });
    } else {
      const r = await fetch(`/api/chat/sessions/${sessionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, streaming: false }),
      });
      const j = await r.json();
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: j.content,
          created_at: new Date().toISOString(),
        },
      ]);
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 pb-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`px-4 py-2 rounded-lg max-w-[85ch] ${
              m.role === 'user' ? 'bg-slate-800 ml-auto' : 'bg-slate-900 border border-slate-800'
            }`}
          >
            <div className="text-xs uppercase text-slate-500 mb-1">{m.role}</div>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {pending !== null && (
          <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 max-w-[85ch]">
            <div className="text-xs uppercase text-slate-500 mb-1">assistant · streaming</div>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{pending || '…'}</ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-800 pt-3 space-y-2">
        <div className="flex gap-2 items-center text-xs text-slate-400">
          <label className="flex gap-1 items-center">
            <input
              type="checkbox"
              checked={streaming}
              onChange={(e) => setStreaming(e.target.checked)}
            />
            stream
          </label>
        </div>
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1"
            rows={3}
            placeholder="message…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
