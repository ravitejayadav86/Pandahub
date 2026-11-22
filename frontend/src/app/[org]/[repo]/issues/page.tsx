'use client';

import PageSkeleton from '@/components/ui/PageSkeleton';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Issue, Repository } from '@/types';
import { useAuthStore } from '@/store/authStore';

export default function IssuesPage() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params.org;
  const repoName = params.repo;
  const { user } = useAuthStore();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newIssue, setNewIssue] = useState({ title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!owner || !repoName) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      api.get<Repository>(`/${owner}/${repoName}`, { signal: controller.signal }),
      api.get<{ items: Issue[]; total: number } | Issue[]>(`/${owner}/${repoName}/issues`, {
        params: { state: filter }, signal: controller.signal,
      }),
    ]).then(([repoResponse, issueResponse]) => {
      if (controller.signal.aborted) return;
      setRepo(repoResponse.data);
      const payload = issueResponse.data;
      setIssues(Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setIssues([]);
        setError('Unable to load issues. Check your connection and try again.');
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, repoName, filter, reload]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !newIssue.title.trim()) return;
    setSubmitting(true);
    setCreateError('');
    try {
      await api.post(`/${owner}/${repoName}/issues`, {
        title: newIssue.title.trim(), description: newIssue.body.trim() || null,
      });
      setNewIssue({ title: '', body: '' });
      setShowNew(false);
      setFilter('open');
      setReload((value) => value + 1);
    } catch {
      setCreateError('Could not create the issue. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ padding: '20px 1.5rem' }}>
          <nav style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <Link href={`/${owner}`}>{owner}</Link>
            <span>/</span>
            <Link href={`/${owner}/${repoName}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{repoName}</Link>
            <span>/</span>
            <span>Issues</span>
          </nav>
        </div>
      </div>

      <div className="container" style={{ padding: '24px 1.5rem' }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 4 }}>
            {(['open', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: filter === s ? 'var(--bg-tertiary)' : 'transparent',
                  color: filter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: filter === s ? 600 : 400,
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                {s === 'open' ? `● ${repo?.open_issues_count ?? 0} Open` : '✓ Closed'}
              </button>
            ))}
          </div>
          {user && (
            <button
              onClick={() => setShowNew(!showNew)}
              style={{
                padding: '8px 18px', borderRadius: 8,
                background: 'var(--gradient-brand)',
                color: '#1F2937', fontWeight: 600, fontSize: 14,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(124,58,237,0.3)',
              }}
            >
              + New issue
            </button>
          )}
        </div>

        {/* New issue form */}
        {showNew && (
          <div className="glass-card" style={{ padding: '24px', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Create a new issue</h3>
            <form onSubmit={handleCreateIssue} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {createError && <p role="alert" className="ph-inline-error">{createError}</p>}
              <input
                type="text"
                placeholder="Issue title"
                value={newIssue.title}
                onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                required
                style={inputStyle}
              />
              <textarea
                placeholder="Describe the issue…"
                value={newIssue.body}
                onChange={(e) => setNewIssue({ ...newIssue, body: e.target.value })}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px', borderRadius: 8,
                    background: 'var(--gradient-brand)',
                    color: '#1F2937', fontWeight: 600, border: 'none', cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit issue'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Issue list */}
        {loading ? (
          <PageSkeleton variant="list" label="Loading issues" />
        ) : error ? (
          <div className="ph-inline-error" role="alert">
            {error} <button type="button" onClick={() => setReload((value) => value + 1)} className="ph-retry-button">Retry</button>
          </div>
        ) : issues.length === 0 ? (
          <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>No {filter} issues</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {filter === 'open' ? 'Everything looks good!' : 'No issues have been closed yet.'}
            </p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {issues.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} owner={owner} repoName={repoName} isLast={i === issues.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue, owner, repoName, isLast }: {
  issue: Issue; owner: string; repoName: string; isLast: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-muted)',
      background: 'transparent',
      transition: 'background var(--transition-fast)',
      cursor: 'pointer',
    }}
    >
      <span style={{ fontSize: 18, marginTop: 2, flexShrink: 0 }}>
        {issue.state === 'open' ? '●' : '✓'}
      </span>
      <div style={{ flex: 1 }}>
        <Link
          href={`/${owner}/${repoName}/issues/${issue.number}`}
          style={{
            fontWeight: 600, color: 'var(--text-primary)', fontSize: 15,
            display: 'block', marginBottom: 4,
          }}
        >
          {issue.title}
        </Link>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          #{issue.number} opened {new Date(issue.created_at).toLocaleDateString()}
        </span>
      </div>
      {issue.comment_count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
          💬 {issue.comment_count}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, outline: 'none',
  fontFamily: 'var(--font-sans)',
};
