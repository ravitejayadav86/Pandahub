'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { generateKeyPair, exportPublicKey, savePrivateKey, loadPrivateKey } from '@/lib/crypto';

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  // Auto-initialize E2EE keys for every logged-in user silently in the background.
  // This ensures that when anyone tries to message this user, their public key is
  // already on the server — eliminating the "E2EE Not Set Up" chicken-and-egg problem.
  useEffect(() => {
    if (!user) return;

    const ensureE2EEKeys = async () => {
      try {
        // First check if the server already has a public key for this user
        const { data: profile } = await api.get(`/auth/users/${user.username}`);
        if (profile.public_key) return; // Already set up, nothing to do

        // Try loading an existing private key from IndexedDB first
        let privKey = await loadPrivateKey();
        if (!privKey) {
          // Generate a fresh key pair
          const keyPair = await generateKeyPair();
          privKey = keyPair.privateKey;
          await savePrivateKey(privKey);
          const pubKeyBase64 = await exportPublicKey(keyPair.publicKey);
          await api.post('/messages/keys', { public_key: pubKeyBase64 });
        }
      } catch {
        // Silently ignore — this is a background optimization, not critical path
      }
    };

    ensureE2EEKeys();
  }, [user]);

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };


  return (
    <header style={{
      height: 60, background: '#fff', borderBottom: '1px solid var(--border-color)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    }}>
      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0f172a, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>public</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>PandaHub</span>
      </Link>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 400, margin: '0 32px', position: 'relative' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-muted)' }}>search</span>
        <input type="text" placeholder="Search repositories, users…" style={{
          width: '100%', height: 36, paddingLeft: 38, paddingRight: 12,
          border: '1.5px solid var(--border-color)', borderRadius: 8,
          fontSize: 13, outline: 'none', background: 'var(--bg-primary)',
          fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)'}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-color)'}
        />
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href="/new" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 8, background: 'var(--text-primary)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New
        </Link>
        <Link href="/explore" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>explore</span>
          Explore
        </Link>
        <Link href="/startups" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
          Startups
        </Link>

        {user ? (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setProfileOpen(!profileOpen)} style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--border-color)', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>{user.username.charAt(0).toUpperCase()}</span>
              )}
            </button>
            {profileOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, width: 220, background: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{user.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                </div>
                {[
                  { href: '/dashboard', icon: 'grid_view', label: 'Dashboard' },
                  { href: '/settings', icon: 'settings', label: 'Settings' },
                ].map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
                <div style={{ borderTop: '1px solid var(--border-color)' }}>
                  <button onClick={handleSignOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        )}
      </div>
    </header>
  );
}
