'use client';

/**
 * Custom 404 page — Next.js App Router.
 * Shown whenever a route is not found.
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 font-sans">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/6 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative text-center max-w-md w-full">
        {/* Giant 404 */}
        <div className="relative mb-6 select-none">
          <div
            className="text-[180px] font-black leading-none text-transparent"
            style={{
              WebkitTextStroke: '2px rgba(255,255,255,0.05)',
              letterSpacing: '-8px',
            }}
          >
            404
          </div>
          {/* Panda overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="text-7xl animate-bounce" style={{ animationDuration: '3s' }}>🐼</div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-red-500/50">
                ?
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          Lost in the bamboo forest
        </h1>
        <p className="text-slate-400 text-base leading-relaxed mb-8">
          This page doesn&apos;t exist — the URL might be wrong, or the resource
          may have been moved or deleted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-95"
          >
            🏠 Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/4 text-slate-300 font-medium text-sm hover:bg-white/8 transition-all"
          >
            ← Go back
          </button>
        </div>

        {/* Helpful links */}
        <div className="mt-10 pt-6 border-t border-white/6">
          <p className="text-xs text-slate-600 mb-3">Or try one of these:</p>
          <div className="flex items-center justify-center gap-6 text-xs">
            <Link href="/"         className="text-slate-500 hover:text-slate-300 transition-colors">Home</Link>
            <Link href="/explore"  className="text-slate-500 hover:text-slate-300 transition-colors">Explore</Link>
            <Link href="/settings" className="text-slate-500 hover:text-slate-300 transition-colors">Settings</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
