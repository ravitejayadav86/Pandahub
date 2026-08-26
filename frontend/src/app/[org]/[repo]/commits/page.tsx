'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRepo, useBranches } from '@/hooks/useRepo';
import { useCommits, shortSha, relativeTime } from '@/hooks/useCommits';
import RepoHeader from '@/components/shared/RepoHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

export default function CommitsPage() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params.org;
  const repoName = params.repo;
  const [selectedBranch, setSelectedBranch] = useState('');
  const [page, setPage] = useState(1);

  const { repo } = useRepo(owner, repoName);
  const { branches } = useBranches(owner, repoName);
  const ref =
    selectedBranch ||
    branches.find((b) => b.name === repo?.default_branch)?.name ||
    branches[0]?.name ||
    repo?.default_branch ||
    "main";
  const { commits, loading, error, hasMore } = useCommits(owner, repoName, ref, page);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      <RepoHeader owner={owner} repoName={repoName} repo={repo} activeTab="commits" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            <select value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setPage(1); }}
              className="glass-input"
              style={{ padding: '8px 36px 8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none' }}>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              {branches.length === 0 && <option value="main">main</option>}
            </select>
            <span className="material-symbols-outlined" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-muted)', pointerEvents: 'none' }}>expand_more</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Commits on <strong style={{ color: 'var(--text-primary)' }}>{ref || 'main'}</strong></span>
        </div>
        {loading ? <LoadingSpinner label="Loading commits..." />
          : error ? <EmptyState icon="error" title="Could not load commits" description={error} />
          : commits.length === 0 ? <EmptyState icon="commit" title="No commits yet" description="Push your first commit to see it here." />
          : (
            <div className="glass-card" style={{ borderRadius: 20, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
              {commits.map((commit, i) => (
                <div key={commit.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 24px', borderBottom: i < commits.length - 1 ? '1px solid var(--glass-border)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{commit.author_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{commit.message.split('\n')[0]}</p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{commit.author_name}</span>
                      <span>committed {relativeTime(commit.committed_at)}</span>
                    </div>
                  </div>
                  <Link href={`/${owner}/${repoName}/commit/${commit.sha}`} className="glass-card" style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--glass-border)', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    {shortSha(commit.sha)}
                  </Link>
                </div>
              ))}
            </div>
          )}
        {!loading && commits.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
            {page > 1 && <button onClick={() => setPage(p => p - 1)} className="glass-card" style={{ padding: '8px 20px', borderRadius: 12, border: '1px solid var(--glass-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Previous</button>}
            {hasMore && <button onClick={() => setPage(p => p + 1)} style={{ padding: '8px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>Next</button>}
          </div>
        )}
      </div>
    </div>
  );
}