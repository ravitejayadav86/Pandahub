"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface SecurityAlert {
  id: string;
  alert_type: "secret" | "vulnerability" | "code_quality";
  severity: "critical" | "high" | "medium" | "low" | "info";
  rule_id: string;
  title: string;
  description: string;
  file_path: string;
  line_number: number | null;
  commit_sha: string;
  raw_finding: string;
  is_open: boolean;
  created_at: string;
}

export default function SecurityPage() {
  const { user } = useAuthStore();
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org ?? '';
  const repoName = params?.repo ?? '';

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<"secret" | "vulnerability" | "code_quality">("secret");

  const fetchAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<SecurityAlert[]>(`/${owner}/${repoName}/security/alerts`, {
        params: { alert_type: activeTab, state: 'open' }
      });
      setAlerts(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load security alerts.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (owner && repoName) {
      fetchAlerts();
    }
  }, [owner, repoName, activeTab]);

  const dismissAlert = async (id: string) => {
    try {
      await api.patch(`/${owner}/${repoName}/security/alerts/${id}/dismiss`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert("Failed to dismiss alert.");
    }
  };

  const triggerScan = async () => {
    try {
      await api.post(`/${owner}/${repoName}/security/scan`);
      alert("Security scan enqueued! Results will appear here shortly.");
    } catch (err) {
      alert("Failed to enqueue security scan.");
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] p-8 min-h-screen text-[var(--text-primary)]">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px] text-blue-500">security</span>
              Security Alerts
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Review and manage security findings for <span className="font-semibold text-[var(--text-primary)]">{repoName}</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/${owner}/${repoName}`} className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to repository
            </Link>
            <button
              onClick={triggerScan}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">radar</span>
              Run Full Scan
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--glass-border)] mb-6 gap-6">
          {(['secret', 'vulnerability', 'code_quality'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-semibold capitalize relative transition-colors ${
                activeTab === tab ? "text-blue-500" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.replace('_', ' ')}s
              {activeTab === tab && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-sm font-medium border border-red-500/20 mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="glass-card rounded-2xl border border-[var(--glass-border)] p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">No {activeTab.replace('_', ' ')} alerts</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              We couldn&apos;t find any open {activeTab.replace('_', ' ')} alerts in this repository.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div key={alert.id} className="glass-card rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm hover:scale-[1.005] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${severityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <h3 className="text-base font-bold text-[var(--text-primary)]">{alert.title}</h3>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mb-3 font-mono bg-[var(--glass-bg-2)] border border-[var(--glass-border)] px-2.5 py-1 rounded-md inline-block">
                      {alert.file_path}{alert.line_number ? `:${alert.line_number}` : ''}
                    </div>
                    {alert.description && (
                      <p className="text-sm text-[var(--text-secondary)] mb-4 whitespace-pre-wrap leading-relaxed">{alert.description}</p>
                    )}
                    {alert.raw_finding && (
                      <div className="bg-[var(--glass-bg-4)] border border-[var(--glass-border)] text-slate-200 text-xs font-mono p-3.5 rounded-xl overflow-x-auto whitespace-pre">
                        {alert.raw_finding}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="shrink-0 ml-4 px-3.5 py-1.5 glass-card border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-semibold rounded-xl transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
