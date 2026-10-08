'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { generateKeyPair, exportPublicKey, savePrivateKey, loadPrivateKey } from '@/lib/crypto';

const NAV_LINKS = [
  { href: '/explore',  icon: 'explore',       label: 'Explore'  },
  { href: '/startups', icon: 'rocket_launch',  label: 'Startups' },
];

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* â”€â”€ Auto-initialize E2EE keys silently â”€â”€ */
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

  /* â”€â”€ Close dropdown on outside click â”€â”€ */
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
    <header style={{
      height: 58,
      background: 'var(--glass-bg-4)',
      backdropFilter: '(28px) saturate(2.2)',
      WebkitBackdropFilter: '(28px) saturate(2.2)',
      borderBottom: '1px solid var(--glass-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 1px 0 var(--glass-border-subtle), 0 4px 20px rgba(0,0,0,0.06)',
      /* Inset top highlight â€” premium glass shelf effect */
    }}>

      {/* â”€â”€ Logo â”€â”€ */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'linear-gradient(145deg, #2196f3 0%, #E6E6E6 45%, #A8A8A8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25), ' +
            '0 2px 8px rgba(10,132,255,0.4), 0 1px 2px rgba(0,0,0,0.15)',
          transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.08) rotate(-4deg)';
            (e.currentTarget as HTMLElement).style.boxShadow =
              'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 16px rgba(10,132,255,0.5)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = '';
            (e.currentTarget as HTMLElement).style.boxShadow =
              'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25), ' +
              '0 2px 8px rgba(10,132,255,0.4), 0 1px 2px rgba(0,0,0,0.15)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>hub</span>
        </div>
        <span style={{
          fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
          letterSpacing: '-0.03em', fontFamily: 'Space Grotesk, Inter, sans-serif',
          lineHeight: 1,
        }}>
          Panda<span style={{
            background: 'linear-gradient(120deg, #E6E6E6, #A8A8A8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Hub</span>
        </span>
      </Link>

      {/* â”€â”€ Search â”€â”€ */}
      <div style={{
        flex: 1, maxWidth: 380, margin: '0 24px', position: 'relative',
        transition: 'max-width 0.3s cubic-bezier(0.22,1,0.36,1)',
        ...(searchFocused && { maxWidth: 460 }),
      }}>
        <span className="material-symbols-outlined" style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 17, color: searchFocused ? 'var(--color-primary)' : 'var(--text-muted)',
          transition: 'color 0.2s ease', pointerEvents: 'none',
        }}>search</span>
        <input
          type="text"
          placeholder="Search repositories, usersâ€¦"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%', height: 34,
            paddingLeft: 38, paddingRight: 52,
            border: `1.5px solid ${searchFocused ? 'var(--color-primary)' : 'var(--glass-border)'}`,
            borderRadius: 10,
            fontSize: 13, outline: 'none',
            background: searchFocused ? 'var(--glass-bg-4)' : 'var(--glass-bg-2)',
            color: 'var(--text-primary)',
            backdropFilter: '(16px)',
            WebkitBackdropFilter: '(16px)',
            fontFamily: 'Space Grotesk, Inter, sans-serif',
            boxSizing: 'border-box',
            boxShadow: searchFocused
              ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 3px rgba(10,132,255,0.14), 0 4px 12px rgba(10,132,255,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.22s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        <kbd style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          background: 'var(--glass-bg-1)', border: '1px solid var(--glass-border)',
          borderRadius: 5, padding: '2px 5px', letterSpacing: '0.02em',
          opacity: searchFocused ? 0 : 0.75,
          transition: 'opacity 0.18s ease', pointerEvents: 'none',
        }}>âŒ˜K</kbd>
      </div>

      {/* â”€â”€ Nav links + right side â”€â”€ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* Nav items */}
        {NAV_LINKS.map(link => {
          const active = isActive(link.href);
          return (
            <Link key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 11px', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: active ? 650 : 500,
              color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
              background: active ? 'rgba(10,132,255,0.09)' : 'transparent',
              border: `1px solid ${active ? 'rgba(10,132,255,0.18)' : 'transparent'}`,
              boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
              position: 'relative', fontFamily: 'Space Grotesk, Inter, sans-serif',
            }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-1)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}

        <div style={{ width: 1, height: 20, background: 'var(--glass-border)', margin: '0 6px' }} />

        {/* New repo button */}
        <Link href="/new" className="btn-primary btn-ripple" style={{
          padding: '6px 13px', borderRadius: 8, fontSize: 13,
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>add</span>
          New
        </Link>

        {/* Avatar / Auth */}
        {user ? (
          <div ref={dropdownRef} style={{ position: 'relative', marginLeft: 4 }}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              style={{
                width: 32, height: 32, borderRadius: '50%', padding: 0,
                border: profileOpen
                  ? '2px solid #ffffff'
                  : '1px solid #333333',
                background: profileOpen
                  ? 'transparent'
                  : '#18181b',
                cursor: 'pointer', outline: 'none', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: profileOpen
                  ? '0 0 0 3px rgba(255,255,255,0.2)'
                  : 'none',
                transform: profileOpen ? 'scale(0.94)' : 'scale(1)',
              }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div className="motion-" style={{
                position: 'absolute', right: 0, top: 40, width: 230,
                background: 'var(--glass-bg-4)',
                backdropFilter: '(32px) saturate(2)',
                WebkitBackdropFilter: '(32px) saturate(2)',
                borderRadius: 14, border: '1px solid var(--glass-border)',
                boxShadow:
                  '0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.14), ' +
                  'inset 0 1px 0 rgba(255,255,255,0.22)',
                zIndex: 100, overflow: 'hidden',
              }}>
                {/* User info */}
                <div style={{
                  padding: '14px 16px 12px',
                  borderBottom: '1px solid var(--glass-border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: '#18181b', border: '1px solid #333333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'none',
                    overflow: 'hidden',
                  }}>
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{user.username.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{user.email}</div>
                  </div>
                </div>

                {/* Links */}
                <div style={{ padding: '6px 0' }}>
                  {[
                    { href: '/dashboard', icon: 'grid_view',  label: 'Dashboard' },
                    { href: '/settings',  icon: 'tune',       label: 'Settings'  },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setProfileOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', fontSize: 13, fontWeight: 500,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                      transition: 'background 0.12s ease, color 0.12s ease',
                      fontFamily: 'Space Grotesk, Inter, sans-serif',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-2)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 17, opacity: 0.75 }}>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', padding: '6px 0' }}>
                  <button onClick={handleSignOut} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', fontSize: 13, fontWeight: 500,
                    color: '#A6A6A6', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'Space Grotesk, Inter, sans-serif',
                    transition: 'background 0.12s ease',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>logout</span>
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


