"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getAccessToken, logout } from '@/lib/auth';

export default function DashboardNav() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    logout();
    clearAuth();
    router.push('/');
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(13, 17, 23, 0.9)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 60,
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>🐼</div>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
            PandaHub
          </span>
        </Link>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/explore" style={navBtnStyle}>Explore</Link>
          <Link href="/new" style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--surface-variant)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
          }}>+ New repo</Link>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff',
              }}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, padding: '4px 8px',
                }}
              >Sign out</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8,
  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
};
