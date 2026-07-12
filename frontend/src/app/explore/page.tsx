'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Repository } from '@/types';

export default function ExplorePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated' | 'stars' | 'forks'>('updated');
  const [loading, setLoading] = useState(true);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Repository[]>(`/explore/repos`, {
        params: { q: query || undefined, sort, limit: 24 },
      });
      setRepos(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadRepos(); }, [sort]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadRepos();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '40px 0 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        }} />
        <div className="container">
          <Link href="/" style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, display: 'block' }}>
            ← PandaHub
          </Link>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Explore</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Discover public repositories from the community.
          </p>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
            <input
              type="text"
              placeholder="Search repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1, padding: '10px 16px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 14, outline: 'none',
              }}
            />
            <button type="submit" style={{
              padding: '10px 20px', borderRadius: 8,
              background: 'var(--gradient-brand)',
              color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer',
            }}>
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container" style={{ padding: '24px 1.5rem' }}>
        {/* Sort controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sort by:</span>
          {(['updated', 'stars', 'forks'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                background: sort === s ? 'var(--bg-tertiary)' : 'transparent',
                color: sort === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: sort === s ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Repos grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card" style={{ padding: 24, opacity: 0.5 }}>
                <div style={{ width: 180, height: 16, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ width: '70%', height: 12, background: 'var(--bg-hover)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : repos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p>No repositories found. Try a different search.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {repos.map((repo) => (
              <ExploreRepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExploreRepoCard({ repo }: { repo: Repository }) {
  const [hovered, setHovered] = useState(false);
  const owner = repo.owner_username || repo.slug.split('/')[0];
  const name = repo.name;
  return (
    <Link
      href={`/${owner}/${name}`}
      className="glass-card animate-fade-in"
      style={{
        display: 'block', padding: '20px 22px',
        textDecoration: 'none', color: 'inherit',
        transition: 'all var(--transition-normal)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'var(--shadow-sm)',
        borderColor: hovered ? 'rgba(124,58,237,0.3)' : 'var(--border-color)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--gradient-brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {owner?.[0]?.toUpperCase() || 'U'}
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{owner}</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontWeight: 700, color: 'var(--brand-accent)' }}>{name}</span>
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
        <span>⭐ {repo.star_count}</span>
        <span>🔀 {repo.fork_count}</span>
        <span style={{ marginLeft: 'auto' }}>
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}
