'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import PandaLoader from '@/components/ui/PandaLoader';

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
  { key: 'all',            label: 'All',           color: '#6b7280', glow: 'rgba(107,114,128,0.25)' },
  { key: 'idea',           label: 'Idea',          color: '#a78bfa', glow: 'rgba(167,139,250,0.28)' },
  { key: 'mvp',            label: 'MVP',           color: '#E6E6E6', glow: 'rgba(10,132,255,0.28)'  },
  { key: 'early_traction', label: 'Early Traction',color: '#B8B8B8', glow: 'rgba(6,182,212,0.28)'  },
  { key: 'growth',         label: 'Growth',        color: '#BDBDBD', glow: 'rgba(34,197,94,0.28)'   },
  { key: 'scaling',        label: 'Scale',         color: '#f59e0b', glow: 'rgba(245,158,11,0.28)'  },
];

function stageInfo(stage: string) {
  return STAGES.find(s => s.key === stage) ?? STAGES[0]!;
}

/* Animated count-up hook */
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff  = target - start;
    const steps = 30;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setVal(Math.round(start + diff * (step / steps)));
      if (step >= steps) { clearInterval(id); prev.current = target; }
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

/* Skeleton card */
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--glass-bg-3)',
      border: '1px solid var(--glass-border)',
      backdropFilter: '(12px)',
    }}>
      <div style={{ height: 80, background: 'var(--glass-bg-1)' }}>
        <div style={{ margin: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
          <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ width: '55%', height: 18, borderRadius: 6, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: '90%', height: 13, borderRadius: 5, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '70%', height: 13, borderRadius: 5, marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 52, height: 30, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

/* Single startup card */
function StartupCard({ startup, index }: { startup: Startup; index: number }) {
  const router = useRouter();
  const stage  = stageInfo(startup.stage);
  const cardRef = useRef<HTMLDivElement>(null);

  /* 3D tilt on mouse move */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el   = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width  - 0.5;
    const y    = (e.clientY - rect.top)  / rect.height - 0.5;
    el.style.transform = `translate3d(0,-8px,0) scale3d(1.012,1.012,1) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    el.style.boxShadow = `
      0 2px 4px rgba(0,0,0,0.04),
      0 14px 32px rgba(15,23,42,0.16),
      0 36px 72px ${stage.glow},
      0 0 0 1px rgba(255,255,255,0.06) inset`;
  };
  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
  };

  return (
    <div
      ref={cardRef}
      className={`glass-card card-motion- motion-stagger-${Math.min(index + 1, 8)}`}
      style={{
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(`/startups/${startup.slug}`)}
    >
      {/* Card Header */}
      <div style={{
        height: 82,
        background: `linear-gradient(135deg, ${stage.color}22 0%, ${stage.color}0a 60%, transparent 100%)`,
        padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--glass-border)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle scan-line shimmer on header */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${stage.color}08 50%, transparent 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
          pointerEvents: 'none',
        }} />

        {/* Logo badge */}
        <div className="skeu-icon-badge" style={{
          width: 44, height: 44,
          background: startup.logo_url
            ? 'transparent'
            : `linear-gradient(145deg, ${stage.color}ee, ${stage.color}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {startup.logo_url
            ? <img src={startup.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{startup.name[0]}</span>
          }
        </div>

        {/* Stage badge */}
        <span style={{
          padding: '4px 11px', borderRadius: 99,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          background: `${stage.color}20`,
          color: stage.color,
          border: `1px solid ${stage.color}40`,
          textTransform: 'uppercase',
          boxShadow: `0 0 8px ${stage.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}>
          {stage.label}
        </span>
      </div>

      {/* Card Body */}
      <div style={{ padding: '20px 20px 18px' }}>
        <h3 style={{
          fontSize: 16, fontWeight: 750, marginBottom: 6,
          color: 'var(--text-primary)', letterSpacing: '-0.02em',
          lineHeight: 1.2, fontFamily: 'Space Grotesk, Inter, sans-serif',
        }}>{startup.name}</h3>

        <p style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55,
          marginBottom: 18, minHeight: 40,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {startup.tagline || 'No tagline yet.'}
        </p>

        {/* Footer row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{
              fontSize: 12, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
              {startup.member_count || 0}
            </span>
            {(startup.open_roles_count || 0) > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#BDBDBD',
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 99, padding: '2px 8px',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#BDBDBD',
                  boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                  animation: 'pulse-ring 2s ease-in-out infinite',
                  display: 'inline-block', flexShrink: 0,
                }} />
                {startup.open_roles_count} open
              </span>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); router.push(`/startups/${startup.slug}`); }}
            className="btn-glass btn-ripple"
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12 }}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function StartupsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [startups,    setStartups]    = useState<Startup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [mounted,     setMounted]     = useState(false);

  // Animated stats
  const totalCount  = useCountUp(startups.length);
  const rolesCount  = useCountUp(startups.reduce((a, s) => a + (s.open_roles_count || 0), 0));
  const earlyCount  = useCountUp(startups.filter(s => s.stage === 'idea' || s.stage === 'mvp').length);
  const memberCount = useCountUp(startups.reduce((a, s) => a + (s.member_count || 0), 0));

  useEffect(() => { setMounted(true); }, []);

  const loadStartups = useCallback(async (q?: string, stage?: string) => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if ((stage ?? stageFilter) !== 'all') params.stage = stage ?? stageFilter;
      if (q ?? search) params.q = q ?? search;
      const res = await api.get<Startup[]>('/startups', { params });
      setStartups(res.data);
    } catch {
      setError('Failed to load startups. Please try again.');
      setStartups([]);
    }
    setLoading(false);
  }, [stageFilter, search]);

  useEffect(() => { loadStartups(); }, [stageFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadStartups(search, stageFilter);
  };

  const clearSearch = () => {
    setSearch('');
    loadStartups('', stageFilter);
  };

  const STATS = [
    { value: totalCount,  label: 'Listed',     icon: 'rocket_launch' },
    { value: rolesCount,  label: 'Open Roles',  icon: 'work'          },
    { value: earlyCount,  label: 'Early Stage', icon: 'lightbulb'     },
    { value: memberCount, label: 'Builders',    icon: 'group'         },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Space Grotesk, Inter, sans-serif' }}>

      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        background: '#000000',
        padding: 'clamp(48px,9vw,88px) 20px clamp(56px,11vw,110px)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Animated mesh blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', width: '50vw', height: '50vw', maxWidth: 600, maxHeight: 600,
            top: '-10%', left: '-8%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
            animation: 'spatialDrift 10s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500,
            bottom: '-15%', right: '-5%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 65%)',
            animation: 'spatialDrift 14s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute', width: '30vw', height: '30vw', maxWidth: 360, maxHeight: 360,
            top: '30%', left: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 65%)',
            animation: 'spatialDrift 8s ease-in-out infinite 2s',
          }} />
          {/* Subtle grid overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
          }} />
        </div>

        <div style={{
          maxWidth: 760, margin: '0 auto', textAlign: 'center',
          position: 'relative',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Eyebrow pill */}
          <div className="motion-" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.28)',
            borderRadius: 99, padding: '6px 16px', marginBottom: 22,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.08em' }}>STARTUP HUB</span>
          </div>

          {/* Headline */}
          <h1 className="motion-" style={{
            fontSize: 'clamp(30px, 6.5vw, 52px)',
            fontWeight: 900, color: '#fff', margin: '0 0 14px',
            lineHeight: 1.06, letterSpacing: '-0.035em',
            fontFamily: 'Space Grotesk, Inter, sans-serif',
          }}>
            Find Your Next
            <br />
            <span style={{
              background: 'linear-gradient(120deg, #818cf8 0%, #38bdf8 50%, #34d399 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', backgroundSize: '200% 200%',
              animation: 'gradient-shift 5s ease infinite',
              display: 'inline-block',
            }}>Big Venture</span>
          </h1>

          {/* Sub */}
          <p className="motion-" style={{
            fontSize: 'clamp(14px, 2.8vw, 18px)',
            color: 'rgba(255,255,255,0.52)', marginBottom: 34, lineHeight: 1.65, maxWidth: 520, margin: '0 auto 34px',
          }}>
            Discover early-stage startups, join as a collaborator, and build the next generation of products.
          </p>

          {/* CTAs */}
          <div className="motion-" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {user && (
              <button onClick={() => router.push('/startups/new')} className="btn-primary btn-ripple" style={{
                padding: '13px 26px', borderRadius: 12, fontSize: 14,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 19, fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                List Your Startup
              </button>
            )}
            <a href="#explore" className="btn-glass btn-ripple" style={{
              padding: '13px 26px', borderRadius: 12, fontSize: 14, textDecoration: 'none',
              color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.14)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>explore</span>
              Explore All
            </a>
          </div>
        </div>
      </div>

      {/* â”€â”€ Stats Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        background: 'var(--glass-bg-3)',
        backdropFilter: '(24px) saturate(1.8)',
        WebkitBackdropFilter: '(24px) saturate(1.8)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
        overflowX: 'auto',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', minWidth: 'max-content' }}>
          {STATS.map((stat, i) => (
            <div key={stat.label} style={{
              flex: '0 0 auto', width: 160, padding: '16px 20px',
              borderRight: i < STATS.length - 1 ? '1px solid var(--glass-border)' : 'none',
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 16, color: 'var(--text-muted)', fontVariationSettings: "'FILL' 1",
              }}>{stat.icon}</span>
              <div style={{
                fontSize: 24, fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Space Grotesk, Inter, sans-serif',
              }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Main Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div id="explore" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

        {/* Search + Filters */}
        <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
          {/* Search row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 19, color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
              }}>search</span>
              <input
                type="text"
                placeholder="Search startups by name or tagâ€¦"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="premium-input"
                style={{ width: '100%', height: 46, paddingLeft: 46, paddingRight: search ? 40 : 14, boxSizing: 'border-box' }}
              />
              {search && (
                <button type="button" onClick={clearSearch} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  padding: 2, borderRadius: 4, transition: 'color 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              )}
            </div>
            <button type="submit" className="btn-primary btn-ripple" style={{ height: 46, padding: '0 22px', borderRadius: 12, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Search
            </button>
          </div>

          {/* Stage filters */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {STAGES.map(s => {
              const active = stageFilter === s.key;
              return (
                <button key={s.key} type="button" onClick={() => setStageFilter(s.key)} style={{
                  padding: '7px 15px', borderRadius: 99, fontSize: 12, fontWeight: 650, cursor: 'pointer',
                  border: active ? `2px solid ${s.color}` : '1.5px solid var(--glass-border)',
                  background: active ? `${s.color}20` : 'var(--glass-bg-2)',
                  color: active ? s.color : 'var(--text-secondary)',
                  boxShadow: active ? `0 0 10px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none',
                  backdropFilter: '(10px)',
                  transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
                  whiteSpace: 'nowrap', outline: 'none',
                  fontFamily: 'Space Grotesk, Inter, sans-serif',
                }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </form>

        {/* Results */}
        {loading ? (
          /* Skeleton grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center', padding: '72px 24px',
            background: 'rgba(239,68,68,0.07)',
            borderRadius: 24, border: '1px solid rgba(239,68,68,0.22)',
            backdropFilter: '(12px)',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 52, display: 'block', marginBottom: 14, color: '#A6A6A6',
              fontVariationSettings: "'FILL' 1",
            }}>error</span>
            <p style={{ color: '#A6A6A6', fontWeight: 700, marginBottom: 16, fontSize: 16 }}>{error}</p>
            <button onClick={() => loadStartups()} className="btn-danger btn-ripple" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13 }}>
              Try Again
            </button>
          </div>
        ) : startups.length === 0 ? (
          <div className="glass-card motion-" style={{
            textAlign: 'center', padding: '80px 24px', borderRadius: 24,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 32px rgba(99,102,241,0.2)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 750, marginBottom: 8, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              No startups found
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              {search || stageFilter !== 'all'
                ? 'Try adjusting your search or stage filter.'
                : 'Be the first to list your startup here.'}
            </p>
            {user && (
              <button onClick={() => router.push('/startups/new')} className="btn-primary btn-ripple" style={{ padding: '12px 26px', borderRadius: 12, fontSize: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                List a Startup
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 18,
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{startups.length}</strong> startup{startups.length !== 1 ? 's' : ''}
                {stageFilter !== 'all' && <> in <strong style={{ color: stageInfo(stageFilter).color }}>{stageInfo(stageFilter).label}</strong></>}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
              {startups.map((startup, i) => (
                <StartupCard key={startup.id} startup={startup} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


