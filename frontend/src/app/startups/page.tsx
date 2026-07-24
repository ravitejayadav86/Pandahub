'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface Startup {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  stage: 'idea' | 'mvp' | 'early_traction' | 'growth' | 'scaling';
  created_by: string;
  created_at: string;
  open_roles_count?: number;
  member_count?: number;
}

const STAGES = [
  { key: 'all',            label: 'All Stages',     color: '#6b7280' },
  { key: 'idea',           label: 'Idea',           color: '#8b5cf6' },
  { key: 'mvp',            label: 'MVP',            color: '#0A84FF' },
  { key: 'early_traction', label: 'Early Traction', color: '#06b6d4' },
  { key: 'growth',         label: 'Growth',         color: '#22c55e' },
  { key: 'scaling',        label: 'Scale',          color: '#f59e0b' },
];

function stageInfo(stage: string): { key: string; label: string; color: string } {
  return STAGES.find(s => s.key === stage) ?? STAGES[0]!;
}

export default function StartupsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (stageFilter !== 'all') params.stage = stageFilter;
        if (search) params.q = search;
        const res = await api.get<Startup[]>('/startups', { params });
        setStartups(res.data);
      } catch {
        setError('Failed to load startups. Please try again later.');
        setStartups([]);
      }
      setLoading(false);
    };
    load();
  }, [stageFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (stageFilter !== 'all') params.stage = stageFilter;
        if (search) params.q = search;
        const res = await api.get<Startup[]>('/startups', { params });
        setStartups(res.data);
      } catch {
        setError('Failed to load startups. Please try again later.');
        setStartups([]);
      }
      setLoading(false);
    };
    load();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      {/* Hero Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding: '60px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(6,182,212,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative', opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 999, padding: '6px 16px', marginBottom: 24 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#818cf8' }}>rocket_launch</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', letterSpacing: '0.05em' }}>STARTUP HUB</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, color: '#fff', margin: '0 0 16px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Find Your Next<br />
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Big Venture</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 36, lineHeight: 1.6 }}>
            Discover early-stage startups, join as a collaborator, and build the next generation of developer tools.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {user && (
              <button onClick={() => router.push('/startups/new')} style={{
                padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                List Your Startup
              </button>
            )}
            <a href="#explore" style={{
              padding: '14px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.1)',
              color: '#fff', fontWeight: 600, fontSize: 15, border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>explore</span>
              Explore All
            </a>
          </div>
        </div>
      </div>

      {/* Stats Banner — derived from real data */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border-color)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { value: startups.length.toString(), label: 'Startups Listed' },
            { value: startups.reduce((a, s) => a + (s.open_roles_count || 0), 0).toString(), label: 'Open Roles' },
            { value: startups.filter(s => s.stage === 'idea' || s.stage === 'mvp').length.toString(), label: 'Early Stage' },
            { value: startups.reduce((a, s) => a + (s.member_count || 0), 0).toString(), label: 'Team Members' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ flex: 1, padding: '20px 24px', borderRight: i < 3 ? '1px solid var(--border-color)' : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div id="explore" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        {/* Search + Filter */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'var(--text-muted)' }}>search</span>
            <input
              type="text"
              placeholder="Search startups…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', height: 44, paddingLeft: 44, paddingRight: 16, border: '1px solid var(--border-color)',
                borderRadius: 12, fontSize: 14, outline: 'none', background: '#fff', fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STAGES.map(s => (
              <button key={s.key} type="button" onClick={() => setStageFilter(s.key)} style={{
                padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: stageFilter === s.key ? `2px solid ${s.color}` : '1.5px solid var(--border-color)',
                background: stageFilter === s.key ? `${s.color}15` : '#fff',
                color: stageFilter === s.key ? s.color : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>{s.label}</button>
            ))}
          </div>
          <button type="submit" style={{
            padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
          }}>Search</button>
        </form>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>hourglass_empty</span>
            Loading startups…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px', background: '#fff1f1', borderRadius: 24, border: '1px solid #fca5a5' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#ef4444' }}>error</span>
            <p style={{ color: '#ef4444', fontWeight: 600 }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : startups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', background: '#fff', borderRadius: 24, border: '1px solid var(--border-color)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 56, display: 'block', marginBottom: 16, color: 'var(--text-muted)' }}>rocket_launch</span>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No startups found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {search || stageFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Be the first to list yours!'}
            </p>
            {user && (
              <button onClick={() => router.push('/startups/new')} style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                List a Startup
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {startups.map(startup => {
              const stage = stageInfo(startup.stage);
              return (
                <div key={startup.id} style={{
                  background: '#fff', borderRadius: 20, border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)'; }}
                  onClick={() => router.push(`/startups/${startup.slug}`)}
                >
                  {/* Card Header */}
                  <div style={{ height: 80, background: `linear-gradient(135deg, ${stage.color}22, ${stage.color}08)`, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: startup.logo_url ? 'transparent' : `linear-gradient(135deg, ${stage.color}, ${stage.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      {startup.logo_url
                        ? <img src={startup.logo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                        : <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{startup.name[0]}</span>
                      }
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${stage.color}20`, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {stage.label}
                    </span>
                  </div>
                  {/* Card Body */}
                  <div style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{startup.name}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20, minHeight: 40 }}>{startup.tagline || 'No tagline yet.'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>group</span>
                          {startup.member_count || 0} members
                        </span>
                        {(startup.open_roles_count || 0) > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>work</span>
                            {startup.open_roles_count} open roles
                          </span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/startups/${startup.slug}`); }}
                        style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
