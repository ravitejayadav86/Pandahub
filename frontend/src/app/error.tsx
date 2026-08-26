'use client';

/**
 * Next.js App Router error page.
 * Shown for route-level render errors (different from the React ErrorBoundary
 * which catches errors inside client components).
 *
 * This catches errors thrown during Server Component rendering or
 * in the layout tree above individual pages.
 */

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[NextJS ErrorPage]', error);
  }, [error]);

  const [copied, setCopied] = ('useState' in {}) ? [false, () => {}] : [false, () => {}];
  const digest = error?.digest || 'unknown';

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 font-sans">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Status & icon */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl">💥</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-mono font-medium">
                500
              </span>
              <span className="text-slate-500 text-xs">Internal Error</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Something broke</h1>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden mb-4">
          <div className="p-6">
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              A server-side error occurred while rendering this page.
              This is our fault — you haven&apos;t done anything wrong.
            </p>

            {error.message && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/6 mb-5">
                <p className="text-xs text-slate-400 font-mono break-all">{error.message}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                ↺ Try again
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/4 text-slate-300 text-sm hover:bg-white/8 transition-all"
              >
                🏠 Dashboard
              </button>
            </div>
          </div>

          {/* Error digest */}
          <div className="px-6 py-3 border-t border-white/6 bg-black/20 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Error digest</p>
              <p className="text-xs font-mono text-slate-400">{digest}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(digest);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/6 text-slate-400 hover:bg-white/10 transition-all border border-white/8"
            >
              Copy
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          Persistent errors?{' '}
          <a
            href="https://github.com/mrteji/pandahub/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            Report on GitHub ↗
          </a>
        </p>
      </div>
    </div>
  );
}
