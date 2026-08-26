'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */

interface ErrorRecord {
  id: string;
  code: string;
  message: string;
  path: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  status_code: number;
  request_id: string | null;
  timestamp: string;
}

interface ErrorStat {
  code: string;
  count: number;
  severity: string;
  last_seen: string | null;
}

interface ErrorListResponse {
  total: number;
  items: ErrorRecord[];
}

/* ─────────────────────────────────────────────────────────────────────────
   Config
───────────────────────────────────────────────────────────────────────── */

const SEVERITY_STYLES: Record<string, { badge: string; dot: string; row: string }> = {
  debug:    { badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',    dot: 'bg-slate-400',   row: '' },
  info:     { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       dot: 'bg-blue-400',    row: '' },
  warning:  { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    dot: 'bg-amber-400',   row: 'bg-amber-500/3' },
  error:    { badge: 'bg-red-500/20 text-red-400 border-red-500/30',          dot: 'bg-red-400',     row: 'bg-red-500/3' },
  critical: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', dot: 'bg-purple-400',  row: 'bg-purple-500/5' },
};

/* ─────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────── */

export default function AdminErrorsPage() {
  const { user } = useAuthStore();
  const router   = useRouter();

  const [records, setRecords]         = useState<ErrorRecord[]>([]);
  const [stats, setStats]             = useState<ErrorStat[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [activeTab, setActiveTab]     = useState<'log' | 'stats'>('log');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filterCode, setFilterCode]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [dismissing, setDismissing]   = useState<string | null>(null);
  const [clearing, setClearing]       = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (user && !(user as { is_superuser?: boolean }).is_superuser) {
      router.push('/forbidden');
    }
  }, [user, router]);

  /* ── Data fetching ── */
  const fetchRecords = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filterCode)     params.code     = filterCode;
      if (filterSeverity) params.severity = filterSeverity;

      const res = await api.get<ErrorListResponse>('/admin/errors', { params });
      setRecords(res.data.items);
      setTotal(res.data.total);
    } catch {
      // Not a superuser or endpoint unavailable
    } finally {
      setLoading(false);
    }
  }, [filterCode, filterSeverity]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ stats: ErrorStat[] }>('/admin/errors/stats');
      setStats(res.data.stats);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); fetchStats(); }, [fetchRecords, fetchStats]);

  /* ── Live refresh ── */
  useEffect(() => {
    if (liveRefresh) {
      intervalRef.current = setInterval(() => { fetchRecords(); fetchStats(); }, 10_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveRefresh, fetchRecords, fetchStats]);

  /* ── Actions ── */
  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      await api.delete(`/admin/errors/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } finally {
      setDismissing(null);
    }
  };

  const clearAll = async () => {
    if (!confirm('Clear all error records? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.delete('/admin/errors');
      setRecords([]);
      setStats([]);
      setTotal(0);
    } finally {
      setClearing(false);
    }
  };

  const copyId = (requestId: string) => {
    navigator.clipboard.writeText(requestId).then(() => {
      setCopiedId(requestId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 antialiased">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-600/6 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0d1117]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              ←
            </button>
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <span className="text-base">🚨</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Error Log</h1>
              <p className="text-xs text-slate-500">In-memory · last 500 events</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live refresh toggle */}
            <button
              onClick={() => setLiveRefresh((v) => !v)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                liveRefresh
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-white/10 bg-white/4 text-slate-400 hover:bg-white/8'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {liveRefresh ? 'Live' : 'Auto-refresh off'}
            </button>

            <button
              onClick={() => { fetchRecords(); fetchStats(); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 text-slate-400 hover:bg-white/8 transition-all"
            >
              ↺ Refresh
            </button>

            <button
              onClick={clearAll}
              disabled={clearing || records.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15 disabled:opacity-40 transition-all"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 py-6">

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total errors',  value: total,                                             color: 'text-white' },
            { label: 'Critical',      value: records.filter((r) => r.severity === 'critical').length, color: 'text-purple-400' },
            { label: 'Error',         value: records.filter((r) => r.severity === 'error').length,    color: 'text-red-400' },
            { label: 'Warning',       value: records.filter((r) => r.severity === 'warning').length,  color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-white/3 border border-white/8 w-fit">
          {(['log', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'log' ? '📋 Error Log' : '📊 Stats'}
            </button>
          ))}
        </div>

        {/* ── Log Tab ── */}
        {activeTab === 'log' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <input
                type="text"
                placeholder="Filter by code…"
                value={filterCode}
                onChange={(e) => setFilterCode(e.target.value.toUpperCase())}
                className="px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-violet-500/50 w-44"
              />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-violet-500/50 appearance-none"
              >
                <option value="">All severities</option>
                {['debug', 'info', 'warning', 'error', 'critical'].map((s) => (
                  <option key={s} value={s} className="bg-[#0d1117]">{s}</option>
                ))}
              </select>
              {(filterCode || filterSeverity) && (
                <button
                  onClick={() => { setFilterCode(''); setFilterSeverity(''); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ✕ Clear filters
                </button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">✨</div>
                <p className="text-slate-400 font-medium">No errors recorded</p>
                <p className="text-slate-600 text-sm mt-1">The buffer is empty — everything&apos;s running clean.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[24px_1fr_120px_80px_100px_90px_80px] gap-3 px-4 py-2.5 border-b border-white/6 bg-white/2 text-xs text-slate-600 font-medium uppercase tracking-wider">
                  <div />
                  <div>Error</div>
                  <div>Code</div>
                  <div>Status</div>
                  <div>Path</div>
                  <div>Time</div>
                  <div />
                </div>

                {records.map((record) => {
                  const sev  = SEVERITY_STYLES[record.severity] || SEVERITY_STYLES.error;
                  const isExpanded = expandedId === record.id;
                  return (
                    <div key={record.id} className={`border-b border-white/4 last:border-0 ${sev.row}`}>
                      {/* Main row */}
                      <div
                        className="grid grid-cols-[24px_1fr_120px_80px_100px_90px_80px] gap-3 px-4 py-3 items-start cursor-pointer hover:bg-white/3 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                      >
                        {/* Severity dot */}
                        <div className="pt-1 flex justify-center">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                        </div>

                        {/* Message */}
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{record.message}</p>
                          {record.request_id && (
                            <p className="text-xs text-slate-600 font-mono truncate mt-0.5">
                              {record.request_id}
                            </p>
                          )}
                        </div>

                        {/* Code badge */}
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono font-medium ${sev.badge}`}>
                            {record.code}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="text-xs text-slate-500 font-mono">{record.status_code || '—'}</div>

                        {/* Path */}
                        <div className="text-xs text-slate-500 font-mono truncate">{record.path}</div>

                        {/* Time */}
                        <div className="text-xs text-slate-600">
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {record.request_id && (
                            <button
                              onClick={() => copyId(record.request_id!)}
                              title="Copy Request ID"
                              className="text-slate-600 hover:text-slate-300 transition-colors text-xs"
                            >
                              {copiedId === record.request_id ? '✓' : '⎘'}
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(record.id)}
                            disabled={dismissing === record.id}
                            title="Dismiss"
                            className="text-slate-700 hover:text-red-400 transition-colors text-xs disabled:opacity-40"
                          >
                            {dismissing === record.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-black/20 border-t border-white/4">
                          <div className="mt-3 rounded-xl bg-black/40 border border-white/6 p-4">
                            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                              {JSON.stringify(record, null, 2)}
                            </pre>
                          </div>
                          {record.request_id && (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => copyId(record.request_id!)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/6 text-slate-400 hover:bg-white/10 transition-all border border-white/8"
                              >
                                {copiedId === record.request_id ? '✓ Copied Request ID' : '⎘ Copy Request ID'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === 'stats' && (
          <>
            {statsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              </div>
            ) : stats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-slate-400 font-medium">No stats yet</p>
                <p className="text-slate-600 text-sm mt-1">Stats appear once errors are recorded.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.map((stat) => {
                  const sev = SEVERITY_STYLES[stat.severity] || SEVERITY_STYLES.error;
                  const maxCount = stats[0]?.count || 1;
                  const pct = (stat.count / maxCount) * 100;
                  return (
                    <div key={stat.code} className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
                      <div className="flex items-center gap-4 px-4 py-3">
                        {/* Bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-mono font-medium ${sev.badge}`}>
                                {stat.code}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-white">{stat.count}</span>
                              <span className="text-xs text-slate-600 ml-1">hits</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${sev.dot} transition-all duration-500`}
                              style={{ width: `${pct}%`, opacity: 0.7 }}
                            />
                          </div>
                        </div>

                        {/* Last seen */}
                        <div className="text-xs text-slate-600 flex-shrink-0 w-32 text-right">
                          {stat.last_seen
                            ? `Last: ${new Date(stat.last_seen).toLocaleString()}`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
