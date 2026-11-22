'use client';

import PageSkeleton from '@/components/ui/PageSkeleton';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Repository, User } from '@/types';

import Navbar from '@/components/shared/Navbar';

function ExploreResultsPage() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q')?.trim() || '';
  const [repos, setRepos] = useState<Repository[]>([]);
  const [users, setUsers] = useState<Partial<User>[]>([]);
  const [query, setQuery] = useState(urlQuery);
  const [sort, setSort] = useState<'updated' | 'stars' | 'forks'>('updated');
  const [loading, setLoading] = useState(true);
  const [submittedQuery, setSubmittedQuery] = useState(urlQuery);
  const [requestError, setRequestError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Keep the visible input and result set in sync with the global search URL.
  useEffect(() => {
    setQuery(urlQuery);
    setSubmittedQuery(urlQuery);
  }, [urlQuery]);

  // PANDAHUB_EXPLORE_REQUEST_FIX: abort old searches when the filter changes.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRequestError('');
    Promise.all([
      api.get<Repository[]>('/explore/repos', { params: { q: submittedQuery || undefined, sort, limit: 24 }, signal: controller.signal }),
      api.get<Partial<User>[]>('/auth/explore/users', { params: { q: submittedQuery || undefined, limit: 12 }, signal: controller.signal }),
    ]).then(([reposRes, usersRes]) => {
      if (controller.signal.aborted) return;
      setRepos(reposRes.data);
      setUsers(usersRes.data);
    }).catch(() => {
      if (!controller.signal.aborted) { setRepos([]); setUsers([]); setRequestError('Could not load results. Check your connection and try again.'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sort, submittedQuery, retryKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      {/* Header */}
      <div className="ph-explore-hero" style={{
        background: 'var(--glass-bg-3)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '40px 0 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        }} />
        <div className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Explore PandaHub</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15 }}>
            Discover public repositories, developer communities, and creators.
          </p>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
            <input
              type="text"
              placeholder="Search repositories and users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="glass-input"
              style={{
                flex: 1, padding: '12px 18px',
                borderRadius: 14, color: 'var(--text-primary)',
                fontSize: 14, outline: 'none',
              }}
            />
            <button type="submit" style={{
              padding: '12px 24px', borderRadius: 14,
              background: '#C5BAFF',
              color: '#342B60', fontWeight: 700, border: '1px solid #AFA0E8', cursor: 'pointer',
              boxShadow: '0 6px 17px rgba(137,119,210,0.16)',
            }}>
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Sort controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>Sort Repos by:</span>
          {(['updated', 'stars', 'forks'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: '6px 16px', borderRadius: 999, border: '1px solid var(--glass-border)',
                background: sort === s ? 'var(--glass-bg-4)' : 'var(--glass-bg-2)',
                color: sort === s ? '#51477F' : 'var(--text-secondary)',
                fontWeight: sort === s ? 600 : 500,
                backdropFilter: 'blur(10px)',
                cursor: 'pointer', fontSize: 13, transition: 'all 0.15s ease',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {requestError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{requestError}</span><button type="button" className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold hover:bg-white" onClick={() => setRetryKey(v => v + 1)}>Retry</button></div>}
        {loading ? (
          <PageSkeleton variant="grid" label="Discovering repositories and developers" />
        ) : (repos.length === 0 && users.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p>No repositories or users found. Try a different search.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            
            {/* Users section */}
            {users.length > 0 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Users</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {users.map((user) => (
                    <ExploreUserCard key={user.id} user={user} />
                  ))}
                </div>
              </div>
            )}

            {/* Repos section */}
            {repos.length > 0 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Repositories</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {repos.map((repo) => (
                    <ExploreRepoCard key={repo.id} repo={repo} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function ExploreUserCard({ user }: { user: Partial<User> }) {
  return (
    <Link
      href={`/${user.username}`}
      className="glass-card animate-fade-in ph-explore-hover"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
        textDecoration: 'none', color: 'inherit', borderRadius: 20,
        border: '1px solid var(--glass-border)',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'linear-gradient(135deg, #C8C8C8, #A8A8A8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#1F2937', flexShrink: 0,
        overflow: 'hidden', border: '1px solid var(--glass-border)',
      }}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          user.username?.[0]?.toUpperCase() || 'U'
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.full_name || user.username}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{user.username}</span>
      </div>
    </Link>
  );
}

function ExploreRepoCard({ repo }: { repo: Repository }) {
  const owner = repo.owner_username || repo.slug.split('/')[0];
  const name = repo.name;
  return (
    <Link
      href={`/${owner}/${name}`}
      className="glass-card animate-fade-in ph-explore-hover"
      style={{
        display: 'block', padding: '20px 24px', borderRadius: 20,
        border: '1px solid var(--glass-border)',
        textDecoration: 'none', color: 'inherit',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C8C8C8, #A8A8A8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#1F2937', flexShrink: 0,
        }}>
          {owner?.[0]?.toUpperCase() || 'U'}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{owner}</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{name}</span>
      </div>
      {repo.description && (
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
          marginBottom: 14,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {repo.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>â­ {repo.star_count}</span>
        <span>ðŸ”€ {repo.fork_count}</span>
        <span style={{ marginLeft: 'auto' }}>
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}



// useSearchParams must be under Suspense so /explore can be prerendered by Next.js.
export default function ExplorePage() {
  return <Suspense fallback={<PageSkeleton variant="grid" label="Loading Explore" />}>
    <ExploreResultsPage />
  </Suspense>;
}
