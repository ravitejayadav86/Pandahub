'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

interface AdminStats {
  total_users: number;
  active_users: number;
  total_repos: number;
  total_issues: number;
}

interface AdminUser extends User {
  is_admin?: boolean;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const loadData = async (query: string = '') => {
    setLoading(true);
    try {
      const usersRes = await api.get<AdminUser[]>('/auth/users', { params: { q: query || undefined } });
      setUsers(usersRes.data);
      // Stats should ideally be from a separate stats endpoint if we paginate/search,
      // but we'll leave it as is for simplicity if query is empty.
      if (!query) {
        setStats({
          total_users: usersRes.data.length,
          active_users: usersRes.data.filter((u: AdminUser) => u.is_active).length,
          total_repos: 0,
          total_issues: 0,
        });
      }
    } catch {
      setUsers([]);
      if (!query) setStats({ total_users: 0, active_users: 0, total_repos: 0, total_issues: 0 });
    }
    setLoading(false);
  };

  const filtered = users;

  const statCards = [
    { label: 'Total Users',   value: stats?.total_users ?? 0,   icon: 'group',        color: '#6366f1' },
    { label: 'Active Users',  value: stats?.active_users ?? 0,  icon: 'person_check', color: '#22c55e' },
    { label: 'Repositories',  value: stats?.total_repos ?? 0,   icon: 'folder_open',  color: '#0A84FF' },
    { label: 'Open Issues',   value: stats?.total_issues ?? 0,  icon: 'bug_report',   color: '#f59e0b' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <header style={{
        height: 64, background: 'var(--glass-bg-4)', backdropFilter: 'blur(20px) saturate(1.8)',
        borderBottom: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>admin_panel_settings</span>
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Admin Panel</h1>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>System Management</p>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong></span>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: 'var(--glass-bg-2)', borderRadius: 14, padding: 4, width: 'fit-content', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}>
          {(['overview', 'users'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? 'var(--glass-bg-4)' : 'transparent',
              color: activeTab === tab ? '#3b82f6' : 'var(--text-secondary)',
              boxShadow: activeTab === tab ? 'var(--glass-shadow)' : 'none',
              transition: 'all 0.15s', textTransform: 'capitalize',
            }}>{tab === 'overview' ? 'Overview' : 'Users'}</button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
              {statCards.map(card => (
                <div key={card.label} className="glass-card" style={{ borderRadius: 20, padding: 24, border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${card.color}35` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: card.color }}>{card.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)' }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>{card.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="glass-card" style={{ borderRadius: 20, padding: 28, border: '1px solid var(--glass-border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#22c55e' }}>health_and_safety</span>
                System Status
              </h2>
              {[
                { name: 'API Server', status: 'Operational', color: '#22c55e' },
                { name: 'Database', status: 'Operational', color: '#22c55e' },
                { name: 'Object Storage', status: 'Operational', color: '#22c55e' },
                { name: 'Message Queue', status: 'Operational', color: '#22c55e' },
                { name: 'Email Service', status: 'Operational', color: '#22c55e' },
              ].map(svc => (
                <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{svc.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: svc.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: svc.color, display: 'inline-block' }} />
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div className="glass-card" style={{ borderRadius: 20, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--glass-bg-2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>search</span>
              <input type="text" placeholder="Search users by username or email…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{filtered.length} users</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 80px', padding: '12px 24px', background: 'var(--glass-bg-1)', borderBottom: '1px solid var(--glass-border)' }}>
              {['User', 'Email', 'Verified', 'Active', 'Joined'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>group_off</span>
                <p style={{ fontWeight: 600 }}>No users found</p>
              </div>
            ) : filtered.map((u, i) => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 80px', padding: '14px 24px', borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{u.username.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: u.is_verified ? '#22c55e' : '#f59e0b' }}>{u.is_verified ? '✓ Yes' : '✗ No'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: u.is_active ? '#22c55e' : '#ef4444' }}>{u.is_active ? '● Active' : '○ Inactive'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
