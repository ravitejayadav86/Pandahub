'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRepo, useBranches } from '@/hooks/useRepo';
import { usePulls, createPullRequest, mergePullRequest, PullRequest } from '@/hooks/usePulls';
import RepoHeader from '@/components/shared/RepoHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { relativeTime } from '@/hooks/useCommits';
import { useAuthStore } from '@/store/authStore';

export default function PullsPage() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params.org;
  const repoName = params.repo;
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'open' | 'closed' | 'merged'>('open');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', head_branch: '', base_branch: '' });
  const [submitting, setSubmitting] = useState(false);

  const { repo } = useRepo(owner, repoName);
  const { branches } = useBranches(owner, repoName);
  const { pulls, loading, error, refetch } = usePulls(owner, repoName, filter);

  const defaultBase = repo?.default_branch || 'main';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPullRequest(owner, repoName, { ...form, base_branch: form.base_branch || defaultBase });
      setForm({ title: '', body: '', head_branch: '', base_branch: '' });
      setShowNew(false);
      refetch();
    } catch {}
    setSubmitting(false);
  };

  const stateColor = (state: string) => state === 'open' ? '#22c55e' : state === 'merged' ? '#8b5cf6' : '#94a3b8';
  const stateIcon = (state: string) => state === 'open' ? 'alt_route' : state === 'merged' ? 'merge' : 'close';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      <RepoHeader owner={owner} repoName={repoName} repo={repo} activeTab="pulls" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid var(--border-color)' }}>
            {(['open', 'closed', 'merged'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: filter === s ? 'var(--text-primary)' : 'transparent',
                color: filter === s ? '#fff' : 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}>{s}</button>
            ))}
          </div>
          {user && (
            <button onClick={() => setShowNew(!showNew)} style={{ padding: '9px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              New pull request
            </button>
          )}
        </div>

        {/* New PR Form */}
        {showNew && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-color)', padding: 28, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Open a pull request</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Compare (head branch)</label>
                  <select value={form.head_branch} onChange={e => setForm({...form, head_branch: e.target.value})} required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none' }}>
                    <option value="">Select branch…</option>
                    {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Into (base branch)</label>
                  <select value={form.base_branch || defaultBase} onChange={e => setForm({...form, base_branch: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none' }}>
                    {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="Pull request title"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
                <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={5} placeholder="Describe your changes..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={submitting} style={{ padding: '9px 24px', borderRadius: 9, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                  {submitting ? 'Creating…' : 'Create pull request'}
                </button>
                <button type="button" onClick={() => setShowNew(false)} style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border-color)', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* PR List */}
        {loading ? <LoadingSpinner label="Loading pull requests..." />
          : error ? <EmptyState icon="error" title="Could not load pull requests" description={error} />
          : pulls.length === 0 ? (
            <EmptyState icon="alt_route" title={`No ${filter} pull requests`}
              description={filter === 'open' ? 'Open a pull request to propose changes.' : 'No closed PRs yet.'}
              action={user && filter === 'open' ? { label: 'New pull request', onClick: () => setShowNew(true) } : undefined} />
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              {pulls.map((pr, i) => (
                <div key={pr.id} style={{ display: 'flex', gap: 16, padding: '16px 24px', borderBottom: i < pulls.length - 1 ? '1px solid var(--border-color)' : 'none', alignItems: 'flex-start', transition: 'background 0.15s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: stateColor(pr.state), flexShrink: 0, marginTop: 2 }}>{stateIcon(pr.state)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {pr.title}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>#{pr.number}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{pr.head_branch}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{pr.base_branch}</span>
                      <span>opened {relativeTime(pr.created_at)}</span>
                      {pr.comment_count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>chat_bubble</span>{pr.comment_count}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}