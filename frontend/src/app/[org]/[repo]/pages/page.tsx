'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
type PagesStatus = 'pending' | 'building' | 'active' | 'failed';

interface PagesConfig {
  id: string;
  repository_id: string;
  enabled: boolean;
  source_branch: string;
  source_folder: string;
  status: PagesStatus;
  published_sha: string | null;
  published_at: string | null;
  custom_domain: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
const statusConfig: Record<PagesStatus, { label: string; color: string; dot: string; pulse: boolean }> = {
  pending:  { label: 'Pending',  color: 'text-amber-400',  dot: 'bg-amber-400',  pulse: true  },
  building: { label: 'Building', color: 'text-blue-400',   dot: 'bg-blue-400',   pulse: true  },
  active:   { label: 'Active',   color: 'text-emerald-400',dot: 'bg-emerald-400',pulse: false },
  failed:   { label: 'Failed',   color: 'text-red-400',    dot: 'bg-red-400',    pulse: false },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
export default function PagesSettingsPage() {
  const params  = useParams();
  const router  = useRouter();
  const owner   = params?.org  as string;
  const repoName = params?.repo as string;

  /* ── State ── */
  const [pages, setPages]           = useState<PagesConfig | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [disabling, setDisabling]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [branches, setBranches]     = useState<string[]>(['main']);

  /* ── Form state ── */
  const [branch, setBranch]   = useState('main');
  const [folder, setFolder]   = useState('/');

  /* ── Fetch current Pages config ── */
  const fetchPages = useCallback(async () => {
    try {
      const res = await api.get<PagesConfig>(`/${owner}/${repoName}/pages`);
      setPages(res.data);
      setBranch(res.data.source_branch);
      setFolder(res.data.source_folder);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) {
        setPages(null); // Not enabled yet
      } else {
        setError('Failed to load Pages configuration.');
      }
    } finally {
      setLoading(false);
    }
  }, [owner, repoName]);

  /* ── Fetch branches for dropdown ── */
  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get<{ items: { name: string }[] }>(`/${owner}/${repoName}/branches`);
      const names = res.data.items.map((b) => b.name);
      if (names.length) setBranches(names);
    } catch {
      // Keep default ["main"]
    }
  }, [owner, repoName]);

  useEffect(() => {
    fetchPages();
    fetchBranches();
  }, [fetchPages, fetchBranches]);

  /* ── Auto-refresh while building/pending ── */
  useEffect(() => {
    if (!pages) return;
    if (pages.status !== 'building' && pages.status !== 'pending') return;
    const interval = setInterval(fetchPages, 4000);
    return () => clearInterval(interval);
  }, [pages, fetchPages]);

  /* ── Actions ── */
  const handleEnable = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<PagesConfig>(`/${owner}/${repoName}/pages`, {
        source_branch: branch,
        source_folder: folder,
      });
      setPages(res.data);
      setSuccess('🎉 PandaHub Pages enabled! Your site is building now.');
      setTimeout(() => setSuccess(null), 6000);
    } catch {
      setError('Failed to enable Pages. Make sure you have admin access.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<PagesConfig>(`/${owner}/${repoName}/pages`, {
        source_branch: branch,
        source_folder: folder,
      });
      setPages(res.data);
      setSuccess('Configuration updated — rebuild enqueued.');
      setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError('Failed to update Pages configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const res = await api.post<PagesConfig>(`/${owner}/${repoName}/pages/rebuild`);
      setPages(res.data);
      setSuccess('Rebuild triggered — your site is building.');
      setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError('Failed to trigger rebuild.');
    } finally {
      setRebuilding(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Disable Pages and delete all published artifacts? This cannot be undone.')) return;
    setDisabling(true);
    setError(null);
    try {
      await api.delete(`/${owner}/${repoName}/pages`);
      setPages(null);
      setSuccess('Pages disabled and artifacts removed.');
      setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError('Failed to disable Pages.');
    } finally {
      setDisabling(false);
    }
  };

  const copyUrl = () => {
    if (!pages?.url) return;
    navigator.clipboard.writeText(pages.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading Pages settings…</p>
        </div>
      </div>
    );
  }

  const statusInfo = pages ? statusConfig[pages.status] : null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 antialiased">
      {/* ── Background gradient ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-10">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <button onClick={() => router.push(`/${owner}/${repoName}`)} className="hover:text-slate-300 transition-colors">
            {owner}/{repoName}
          </button>
          <span>›</span>
          <span className="text-slate-300">Settings</span>
          <span>›</span>
          <span className="text-violet-400 font-medium">Pages</span>
        </nav>

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xl shadow-lg shadow-violet-500/25">
              🌐
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">PandaHub Pages</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Host a static website directly from your repository
              </p>
            </div>
          </div>
        </div>

        {/* ── Toast notifications ── */}
        {error && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <span className="mt-0.5 flex-shrink-0">✕</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <span className="mt-0.5 flex-shrink-0">✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* ── Status card (only when Pages is enabled) ── */}
        {pages && statusInfo && (
          <div className="mb-6 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Animated status indicator */}
                <div className="mt-1 relative flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${statusInfo.dot}`} />
                  {statusInfo.pulse && (
                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusInfo.dot} animate-ping opacity-75`} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                    {pages.status === 'building' && (
                      <span className="text-xs text-slate-500 animate-pulse">Building your site…</span>
                    )}
                  </div>
                  {pages.status === 'active' && pages.published_sha && (
                    <p className="text-xs text-slate-500 mt-1">
                      Built from commit <code className="font-mono text-slate-400">{pages.published_sha.slice(0, 7)}</code>
                      {pages.published_at && (
                        <> · {new Date(pages.published_at).toLocaleString()}</>
                      )}
                    </p>
                  )}
                  {pages.status === 'failed' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Build failed. Check that your branch and folder are correct, then rebuild.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {pages.status === 'active' && pages.url && (
                  <a
                    href={pages.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                  >
                    Visit ↗
                  </a>
                )}
                <button
                  onClick={handleRebuild}
                  disabled={rebuilding || pages.status === 'building' || pages.status === 'pending'}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/8 text-slate-300 hover:bg-white/12 disabled:opacity-40 transition-colors border border-white/10"
                >
                  {rebuilding ? 'Queuing…' : '↺ Rebuild'}
                </button>
              </div>
            </div>

            {/* Live URL bar */}
            {pages.url && (
              <div className="px-6 py-3 border-t border-white/6 bg-white/2 flex items-center gap-3">
                <span className="text-xs text-slate-500 flex-shrink-0">Site URL</span>
                <code className="flex-1 text-xs text-violet-400 truncate font-mono">{pages.url}</code>
                <button
                  onClick={copyUrl}
                  className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Configuration card ── */}
        <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-white/6">
            <h2 className="font-semibold text-white">
              {pages ? 'Source Configuration' : 'Enable PandaHub Pages'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {pages
                ? 'Choose which branch and folder PandaHub Pages builds from.'
                : 'Publish a website from your repository. Choose a branch and folder, and your site goes live automatically on every push.'}
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Branch selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Source Branch
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/6 border border-white/10 text-slate-100 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all appearance-none"
              >
                {branches.map((b) => (
                  <option key={b} value={b} className="bg-[#0d1117]">{b}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                Pages will rebuild automatically when you push to this branch.
              </p>
            </div>

            {/* Folder selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Source Folder
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['/', '/docs'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFolder(f)}
                    className={`px-4 py-3 rounded-xl border text-sm font-mono text-left transition-all ${
                      folder === f
                        ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:bg-white/8'
                    }`}
                  >
                    <span className="block font-semibold">{f}</span>
                    <span className="block text-xs mt-0.5 font-sans text-current opacity-70">
                      {f === '/' ? 'Repository root' : 'docs/ sub-folder'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-white/6 bg-white/2 flex items-center justify-between gap-4">
            {pages ? (
              <>
                <button
                  onClick={handleDisable}
                  disabled={disabling}
                  className="px-4 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-40"
                >
                  {disabling ? 'Disabling…' : 'Disable Pages'}
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving || (branch === pages.source_branch && folder === pages.source_folder)}
                  className="px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/20"
                >
                  {saving ? 'Saving…' : 'Save & Rebuild'}
                </button>
              </>
            ) : (
              <button
                onClick={handleEnable}
                disabled={saving}
                className="ml-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-95"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enabling…
                  </span>
                ) : '🚀 Enable Pages'}
              </button>
            )}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="mt-6 rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/6">
            <h3 className="text-sm font-medium text-slate-300">How PandaHub Pages works</h3>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: '📁',
                title: 'Pick a branch & folder',
                desc: 'PandaHub serves your static files from the branch you choose — main, gh-pages, or any other.',
              },
              {
                icon: '⚡',
                title: 'Auto-deploy on push',
                desc: 'Every push to your Pages branch triggers an automatic rebuild. Zero CI configuration needed.',
              },
              {
                icon: '🌐',
                title: 'Instant public URL',
                desc: 'Your site is live at a public URL the moment the build completes. HTML, CSS, JS, images — all served.',
              },
            ].map((step) => (
              <div key={step.title} className="flex flex-col gap-2">
                <div className="text-2xl">{step.icon}</div>
                <div className="text-sm font-medium text-slate-200">{step.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supported files note ── */}
        <p className="mt-5 text-center text-xs text-slate-600">
          Supports HTML · CSS · JavaScript · images · fonts · any static asset ·{' '}
          <span className="text-slate-500">SPA routing (index.html fallback) enabled</span>
        </p>
      </div>
    </div>
  );
}
