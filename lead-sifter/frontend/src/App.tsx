import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Setup from './pages/Setup';
import Chat from './pages/Chat';
import Context from './pages/Context';
import Run from './pages/Run';
import History from './pages/History';

const NAV: { to: string; label: string }[] = [
  { to: '/setup', label: 'Setup' },
  { to: '/context', label: 'Context' },
  { to: '/chat', label: 'Chat' },
  { to: '/run', label: 'Run' },
  { to: '/history', label: 'History' },
];

export default function App() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-1">
        <div className="text-lg font-semibold mb-4 px-2">Lead Sifter</div>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={`px-3 py-2 rounded-md text-sm hover:bg-slate-800 ${
              loc.pathname.startsWith(n.to) ? 'bg-slate-800 text-white' : 'text-slate-300'
            }`}
          >
            {n.label}
          </Link>
        ))}
        <div className="mt-auto text-xs text-slate-500 px-3 pt-4">phase 1 · local-first</div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/context" element={<Context />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/run" element={<Run />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
