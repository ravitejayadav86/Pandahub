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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const usersRes = await api.get<AdminUser[]>('/auth/users');
      setUsers(usersRes.data);
      setStats({
        total_users: usersRes.data.length,
        active_users: usersRes.data.filter((u: AdminUser) => u.is_active).length,
        total_repos: 0,
        total_issues: 0,
      });
    } catch {
      setUsers([]);
      setStats({ total_users: 0, active_users: 0, total_repos: 0, total_issues: 0 });
    }
    setLoading(false);
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: 'Total Users',   value: stats?.total_users ?? 0,   icon: 'group',        color: '#6366f1' },
    { label: 'Active Users',  value: stats?.active_users ?? 0,  icon: 'person_check', color: '#22c55e' },
    { label: 'Repositories',  value: stats?.total_repos ?? 0,   icon: 'folder_open',  color: '#0A84FF' },
    { label: 'Open Issues',   value: stats?.total_issues ?? 0,  icon: 'bug_report',   color: '#f59e0b' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Bar */}
      <header style={{
        height: 64, background: '#fff', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>admin_panel_settings</span>
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Admin Panel</h1>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>System Management</p>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Signed in as <strong>{user?.username}</strong></span>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: '#fff', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid var(--border-color)' }}>
          {(['overview', 'users'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? 'var(--text-primary)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s', textTransform: 'capitalize',
            }}>{tab === 'overview' ? 'Overview' : 'Users'}</button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
              {statCards.map(card => (
                <div key={card.label} style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: card.color }}>{card.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>{card.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{svc.name}</span>
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
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>search</span>
              <input type="text" placeholder="Search users by username or email…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', fontFamily: 'Inter, sans-serif' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{filtered.length} users</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 80px', padding: '12px 24px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
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
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 80px', padding: '14px 24px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{u.username.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{u.username}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '�'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: u.is_verified ? '#22c55e' : '#f59e0b' }}>{u.is_verified ? '? Yes' : '? No'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: u.is_active ? '#22c55e' : '#ef4444' }}>{u.is_active ? '? Active' : '? Inactive'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
