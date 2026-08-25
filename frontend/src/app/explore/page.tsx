'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Repository, User } from '@/types';

import Navbar from '@/components/shared/Navbar';

export default function ExplorePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [users, setUsers] = useState<Partial<User>[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated' | 'stars' | 'forks'>('updated');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reposRes, usersRes] = await Promise.all([
        api.get<Repository[]>(`/explore/repos`, {
          params: { q: query || undefined, sort, limit: 24 },
        }),
        api.get<Partial<User>[]>(`/auth/explore/users`, {
          params: { q: query || undefined, limit: 12 },
        })
      ]);
      setRepos(reposRes.data);
      setUsers(usersRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [sort]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      {/* Header */}
      <div style={{
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
              placeholder="Search repositories and users…"
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
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
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
                color: sort === s ? '#3b82f6' : 'var(--text-secondary)',
                fontWeight: sort === s ? 600 : 500,
                backdropFilter: 'blur(10px)',
                cursor: 'pointer', fontSize: 13, transition: 'all 0.15s ease',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card" style={{ padding: 24, opacity: 0.5, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                <div style={{ width: 180, height: 16, background: 'var(--glass-bg-4)', borderRadius: 6, marginBottom: 12 }} />
                <div style={{ width: '70%', height: 12, background: 'var(--glass-bg-3)', borderRadius: 6 }} />
              </div>
            ))}
          </div>
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
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/${user.username}`}
      className="glass-card animate-fade-in"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
        textDecoration: 'none', color: 'inherit', borderRadius: 20,
        border: '1px solid var(--glass-border)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--glass-shadow)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
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
  const [hovered, setHovered] = useState(false);
  const owner = repo.owner_username || repo.slug.split('/')[0];
  const name = repo.name;
  return (
    <Link
      href={`/${owner}/${name}`}
      className="glass-card animate-fade-in"
      style={{
        display: 'block', padding: '20px 24px', borderRadius: 20,
        border: '1px solid var(--glass-border)',
        textDecoration: 'none', color: 'inherit',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--glass-shadow)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
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
        <span>⭐ {repo.star_count}</span>
        <span>🔀 {repo.fork_count}</span>
        <span style={{ marginLeft: 'auto' }}>
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}
