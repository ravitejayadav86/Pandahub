'use client';

import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-[#E8F9FF] flex items-center justify-center p-6 font-sans">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06)_0%,transparent_60%)]" />
      </div>

      <div className="relative text-center max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="text-5xl">🔒</span>
            </div>
            <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
              <span className="text-white text-sm font-bold">403</span>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[#1F2937] mb-3">Access denied</h1>
        <p className="text-[#64748B] text-base leading-relaxed mb-8">
          You don&apos;t have permission to access this page or resource.
          If you think this is a mistake, ask a repository admin to grant you access.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#C5BAFF] text-[#26213F] font-semibold text-sm hover:bg-[#B9ACF5] transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            🏠 Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#C4D9FF] bg-[#E8F9FF] text-[#475569] font-medium text-sm hover:bg-[#C4D9FF] transition-all"
          >
            ← Go back
          </button>
        </div>

        {/* Help box */}
        <div className="mt-8 p-4 rounded-xl bg-[#E8F9FF] border border-[#C4D9FF] text-left">
          <p className="text-xs font-medium text-[#475569] mb-2">Why am I seeing this?</p>
          <ul className="space-y-1">
            {[
              'This is a private repository you don\'t have access to',
              'Your role on this project doesn\'t allow this action',
              'You need to be logged in to view this resource',
            ].map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-xs text-[#64748B]">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">·</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
