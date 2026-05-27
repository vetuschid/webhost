import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coto Content Review Agent',
  description: 'Local-first content review and image revision MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-ink text-zinc-100">
      <body className="min-h-screen">
        <header className="border-b border-edge bg-panel">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <a href="/" className="text-sm font-semibold tracking-wide">
              <span className="text-accent">Coto</span> Content Review Agent
            </a>
            <nav className="text-sm flex gap-4 text-zinc-400">
              <a href="/" className="hover:text-zinc-100">Clients</a>
              <a href="/settings" className="hover:text-zinc-100">Settings</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
