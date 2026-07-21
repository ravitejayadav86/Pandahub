"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getAccessToken, logout } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
  { href: '/explore',   label: 'Explore',   icon: 'explore'   },
  { href: '/new',       label: 'New',        icon: 'add_circle' },
];

export default function DashboardNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled]           = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!getAccessToken()) router.push('/login');
  }, [router]);

  // Scroll shadow
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    clearAuth();
    router.push('/');
  };

  const initial = user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <nav
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(255,255,255,0.88)'
          : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderBottom: scrolled
          ? '1px solid rgba(15,23,42,0.1)'
          : '1px solid rgba(15,23,42,0.06)',
        boxShadow: scrolled
          ? '0 4px 24px rgba(15,23,42,0.06)'
          : 'none',
      }}
    >
      <div
        className="max-w-screen-xl mx-auto px-6"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group"
          style={{ textDecoration: 'none' }}
        >
          <div
            className="flex items-center justify-center text-[17px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #0A84FF, #6d28d9)',
              boxShadow: '0 4px 12px rgba(10,132,255,0.3)',
            }}
          >
            🐼
          </div>
          <span
            className="font-bold text-[17px] tracking-tight transition-colors duration-200 group-hover:text-blue-600"
            style={{ color: 'var(--text-primary)' }}
          >
            PandaHub
          </span>
        </Link>

        {/* Centre nav links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                style={{ gap: 6, padding: '7px 12px', fontSize: 13, borderRadius: 9 }}
              >
                <span className="material-symbols-outlined icon text-[17px]">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            className="btn-icon p-2"
            data-tooltip="Notifications"
            aria-label="Notifications"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>

          {/* New repo shortcut */}
          <Link
            href="/new"
            className="btn-glass flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
            style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New repo
          </Link>

          {/* Profile avatar + dropdown */}
          {user && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(s => !s)}
                className="relative flex items-center justify-center rounded-full font-bold text-[13px] text-white transition-all duration-200 hover:scale-110 focus:outline-none"
                style={{
                  width: 34, height: 34,
                  background: 'linear-gradient(135deg, #0A84FF, #6d28d9)',
                  boxShadow: isProfileOpen
                    ? '0 0 0 3px rgba(10,132,255,0.35), 0 0 0 1px rgba(10,132,255,0.8)'
                    : '0 0 0 2px rgba(10,132,255,0)',
                  transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                aria-label="Account menu"
                aria-expanded={isProfileOpen}
              >
                {initial}
                {/* Online dot */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ background: 'var(--color-success)', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }}
                />
              </button>

              {/* Dropdown */}
              {isProfileOpen && (
                <div
                  className="dropdown absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: 'rgba(255,255,255,0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(15,23,42,0.09)',
                    boxShadow: '0 16px 50px rgba(15,23,42,0.14), 0 0 0 1px rgba(255,255,255,0.8) inset',
                  }}
                >
                  {/* User info header */}
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: 'rgba(15,23,42,0.07)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[14px] shrink-0"
                        style={{ background: 'linear-gradient(135deg,#0A84FF,#6d28d9)', boxShadow: '0 4px 10px rgba(10,132,255,0.3)' }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {user.username}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {user.email || `@${user.username}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    {[
                      { icon: 'person',      label: 'Your profile',      href: '/dashboard' },
                      { icon: 'code_blocks', label: 'Repositories',      href: '/dashboard' },
                      { icon: 'star',        label: 'Stars',             href: '/dashboard' },
                      { icon: 'settings',    label: 'Settings',          href: '/settings'  },
                    ].map(item => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setIsProfileOpen(false)}
                        className="sidebar-item w-full text-[13px]"
                        style={{ borderRadius: 9, marginBottom: 1 }}
                      >
                        <span className="material-symbols-outlined icon text-[17px]">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  {/* Sign out */}
                  <div
                    className="p-1.5 border-t"
                    style={{ borderColor: 'rgba(15,23,42,0.07)' }}
                  >
                    <button
                      onClick={handleLogout}
                      className="sidebar-item w-full text-[13px] text-red-500 hover:text-red-600"
                      style={{ borderRadius: 9, color: '#ef4444' }}
                    >
                      <span className="material-symbols-outlined icon text-[17px]">logout</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
