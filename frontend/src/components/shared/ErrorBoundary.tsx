'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Global React Error Boundary.
 *
 * Catches any render-phase error in the entire component tree below it and
 * shows a beautiful, actionable fallback instead of a blank white screen.
 *
 * Usage: wrap the app root in layout.tsx with <ErrorBoundary>.
 *
 * Why a class component?  React Error Boundaries MUST be class components —
 * there is no hook equivalent (getDerivedStateFromError / componentDidCatch
 * are lifecycle methods that don't exist in function components).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production, forward to your error tracking service here
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;

    return (
      <ErrorFallback
        error={error}
        onReset={() => this.setState({ hasError: false, error: null, errorInfo: null })}
      />
    );
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Fallback UI
────────────────────────────────────────────────────────────────────────── */

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const errorText = error?.message || 'An unexpected render error occurred.';
  const errorName = error?.name || 'Error';

  const copyDetails = () => {
    const text = `Error: ${errorName}\nMessage: ${errorText}\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 font-sans">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-5xl select-none">🐼</span>
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
              <span className="text-white text-sm font-bold">!</span>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-red-500/15 bg-red-500/5 backdrop-blur-sm overflow-hidden">
          <div className="px-8 py-7">
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              PandaHub ran into an unexpected error while rendering this page.
              This is a bug on our side — you haven't done anything wrong.
            </p>

            {/* Error name badge */}
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {errorName}
              </span>
            </div>

            {/* Error message */}
            <div className="px-4 py-3 rounded-xl bg-black/30 border border-white/6 mb-6">
              <p className="text-slate-300 text-sm font-mono break-all leading-relaxed">{errorText}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                ↺ Try again
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/4 text-slate-300 text-sm hover:bg-white/8 transition-all"
              >
                🏠 Go to Dashboard
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-white/6 bg-black/20 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              If this keeps happening, copy the error details and file a report.
            </p>
            <button
              onClick={copyDetails}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/6 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all border border-white/8"
            >
              {copied ? '✓ Copied' : '⎘ Copy details'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-5">
          PandaHub ·{' '}
          <a
            href="https://github.com/mrteji/pandahub/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            Report this issue ↗
          </a>
        </p>
      </div>
    </div>
  );
}
