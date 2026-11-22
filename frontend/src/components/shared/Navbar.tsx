'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { generateKeyPair, exportPublicKey, savePrivateKey, loadPrivateKey } from '@/lib/crypto';
import SearchBox from '@/components/shared/SearchBox';
import { Compass, Rocket, Plus } from 'lucide-react';

const NAV_LINKS = [
  { href: '/explore',  icon: Compass, label: 'Explore'  },
  { href: '/startups', icon: Rocket,  label: 'Startups' },
];

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Auto-initialize E2EE keys silently */
  useEffect(() => {
    if (!user) return;
    const ensureE2EEKeys = async () => {
      try {
        const { data: profile } = await api.get(`/auth/users/${user.username}`);
        if (profile.public_key) return;
        let privKey = await loadPrivateKey();
        if (!privKey) {
          const keyPair = await generateKeyPair();
          privKey = keyPair.privateKey;
          await savePrivateKey(privKey);
          const pubKeyBase64 = await exportPublicKey(keyPair.publicKey);
          await api.post('/messages/keys', { public_key: pubKeyBase64 });
        }
      } catch { /* silent */ }
    };
    ensureE2EEKeys();
  }, [user]);

  // Close the menu on Escape as well as clicks outside.
  useEffect(() => {
    if (!profileOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [profileOpen]);

  /* Close profile dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <header className="ph-topbar" style={{
      height: 58,
      background: 'var(--glass-bg-4)',
      backdropFilter: 'blur(28px) saturate(2.2)',
      WebkitBackdropFilter: 'blur(28px) saturate(2.2)',
      borderBottom: '1px solid var(--glass-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 1px 0 var(--glass-border-subtle), 0 4px 20px rgba(0,0,0,0.06)',
    }}>

      {/* ── Logo ── */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'linear-gradient(145deg, #C5BAFF 0%, #C4D9FF 50%, #E8F9FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.55), ' +
            '0 2px 8px rgba(128,111,194,0.18), 0 1px 2px rgba(91,109,160,0.08)',
          transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.08) rotate(-4deg)';
            (e.currentTarget as HTMLElement).style.boxShadow =
              'inset 0 1px 0 rgba(255,255,255,0.65), 0 4px 16px rgba(128,111,194,0.22)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = '';
            (e.currentTarget as HTMLElement).style.boxShadow =
              'inset 0 1px 0 rgba(255,255,255,0.55), ' +
              '0 2px 8px rgba(128,111,194,0.18), 0 1px 2px rgba(91,109,160,0.08)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#1F2937' }}>hub</span>
        </div>
        <span style={{
          fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
          letterSpacing: '-0.03em', fontFamily: 'Space Grotesk, Inter, sans-serif',
          lineHeight: 1,
        }}>
          Panda<span style={{
            background: 'linear-gradient(120deg, #C5BAFF, #C4D9FF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Hub</span>
        </span>
      </Link>

      {/* ── Search Bar & Interactive Search Panel ── */}
      <div className="ph-top-search" style={{ flex: 1, display: 'flex', justifyContent: 'center', margin: '0 20px' }}>
        <SearchBox maxWidth={390} expandedMaxWidth={520} triggerSlash={true} />
      </div>

      {/* ── Nav links + Right Side ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* Nav items */}
        <nav className="ph-top-quick-links" aria-label="Quick links">{NAV_LINKS.map(link => {
          const active = isActive(link.href);
          const NavIcon = link.icon;
          return (
            <Link key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: active ? 650 : 500,
              color: active ? '#51477F' : 'var(--text-secondary)',
              background: active ? 'rgba(197,186,255,0.38)' : 'transparent',
              border: `1px solid ${active ? 'rgba(128,111,194,0.28)' : 'transparent'}`,
              boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.70)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
              position: 'relative', fontFamily: 'Space Grotesk, Inter, sans-serif',
            }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = '#E8F9FF';
                  (e.currentTarget as HTMLElement).style.color = '#51477F';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              <NavIcon style={{ width: 15, height: 15 }} />
              {link.label}
            </Link>
          );
        })}</nav>

        <div className="ph-top-quick-links" style={{ width: 1, height: 20, background: 'var(--glass-border)', margin: '0 6px' }} />

        {/* New repo button */}
        <Link href="/new" className="btn-primary btn-ripple" style={{
          padding: '6px 13px', borderRadius: 8, fontSize: 13,
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Plus style={{ width: 15, height: 15 }} />
          New
        </Link>

        {/* Avatar / Auth */}
        {user ? (
          <div ref={dropdownRef} style={{ position: 'relative', marginLeft: 4 }}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Account menu"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              style={{
                width: 32, height: 32, borderRadius: '50%', padding: 0,
                border: profileOpen
                  ? '2px solid #B8ADEC'
                  : '1px solid #C4D9FF',
                background: profileOpen
                  ? 'transparent'
                  : '#C4D9FF',
                cursor: 'pointer', outline: 'none', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: profileOpen
                  ? '0 0 0 3px rgba(197,186,255,0.28)'
                  : 'none',
                transform: profileOpen ? 'scale(0.94)' : 'scale(1)',
              }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1F2937', lineHeight: 1, fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 40, width: 230,
                background: '#E8F9FF',
                backdropFilter: 'blur(32px) saturate(2)',
                WebkitBackdropFilter: 'blur(32px) saturate(2)',
                borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)',
                boxShadow:
                  '0 2px 4px rgba(0,0,0,0.06), 0 16px 36px rgba(0,0,0,0.4), ' +
                  'inset 0 1px 0 rgba(255,255,255,0.70)',
                zIndex: 100, overflow: 'hidden',
              }}>
                {/* User info */}
                <div style={{
                  padding: '14px 16px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: '#E8F9FF', border: '1px solid #C4D9FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'none',
                    overflow: 'hidden',
                  }}>
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 14, fontWeight: 800, color: '#1F2937' }}>{user.username.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>{user.username}</div>
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>{user.email}</div>
                  </div>
                </div>

                {/* Links */}
                <div style={{ padding: '6px 0' }}>
                  {[
                    { href: '/dashboard', label: 'Dashboard' },
                    { href: `/${user.username}`, label: 'Your Profile' },
                    { href: '/settings', label: 'Settings' },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setProfileOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', fontSize: 13, fontWeight: 500,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                      transition: 'background 0.12s ease, color 0.12s ease',
                      fontFamily: 'Space Grotesk, Inter, sans-serif',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(197,186,255,0.24)';
                        (e.currentTarget as HTMLElement).style.color = '#51477F';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '6px 0' }}>
                  <button onClick={handleSignOut} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', fontSize: 13, fontWeight: 500,
                    color: '#f87171', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'Space Grotesk, Inter, sans-serif',
                    transition: 'background 0.12s ease',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="btn-primary btn-ripple" style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13,
            textDecoration: 'none', marginLeft: 4,
          }}>Sign in</Link>
        )}
      </div>
    </header>
  );
}
