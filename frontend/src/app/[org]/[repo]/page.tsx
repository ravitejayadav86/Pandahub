"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from '@/store/authStore';
import { logout } from '@/lib/auth';
import api from '@/lib/api';

interface UserProfile {
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  repo_count: number;
  follower_count: number;
  following_count: number;
}

interface RepoMeta {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'internal';
  star_count: number;
  fork_count: number;
  watcher_count: number;
  default_branch: string;
  is_fork: boolean;
  pushed_at?: string;
}

export default function RepoDashboardPage() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org ?? '';
  const repoName = params?.repo ?? '';

  const [tab, setTab] = useState("Overview");
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Real user profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Repo metadata from API
  const [repoMeta, setRepoMeta] = useState<RepoMeta | null>(null);
  const [starring, setStarring] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.remove('dark');
  }, []);

  // Fetch repo metadata
  useEffect(() => {
    if (!owner || !repoName) return;
    api.get<RepoMeta>(`/${owner}/${repoName}`)
      .then(({ data }) => setRepoMeta(data))
      .catch(() => setRepoMeta(null));
  }, [owner, repoName]);

  // Fetch public profile for the repo owner
  useEffect(() => {
    if (!owner) return;
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const { data } = await api.get<UserProfile>(`/auth/users/${owner}`);
        setProfile(data);
      } catch {
        setProfile(null);
      }
      setProfileLoading(false);
    };
    fetchProfile();
  }, [owner]);

  // Close dropdown when clicking outside
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

  // Stat display helper — shows skeleton dashes while loading
  const stat = (value: number | undefined, loading: boolean) =>
    loading ? <span style={{ color: '#cbd5e1' }}>—</span> : value ?? 0;

  const repoBase = `/${owner}/${repoName}`;

  // Sidebar nav items — all properly routed
  const sidebarItems = [
    { id: "overview",  label: "Overview",       icon: "grid_view",    href: repoBase },
    { id: "code",      label: "Code",           icon: "code",         href: repoBase },
    { id: "commits",   label: "Commits",        icon: "commit",       href: `${repoBase}/commits` },
    { id: "issues",    label: "Issues",         icon: "adjust",       href: `${repoBase}/issues` },
    { id: "prs",       label: "Pull Requests",  icon: "alt_route",    href: `${repoBase}/pulls` },
    { id: "actions",   label: "Actions",        icon: "play_circle",  href: "#", comingSoon: true },
    { id: "projects",  label: "Projects",       icon: "kanban",       href: "#", comingSoon: true },
    { id: "wiki",      label: "Wiki",           icon: "menu_book",    href: "#", comingSoon: true },
    { id: "security",  label: "Security",       icon: "security",     href: `${repoBase}/security` },
    { id: "insights",  label: "Insights",       icon: "insights",     href: "#", comingSoon: true },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans antialiased overflow-x-hidden flex">

      {/* ── Sticky Sidebar ── */}
      <aside className="self-start sticky top-0 h-screen w-[260px] shrink-0 bg-white border-r border-slate-200/60 z-50 flex flex-col overflow-y-auto overscroll-contain scroll-smooth hidden md:flex transition-all duration-300 hover:shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* Logo */}
        <div className="h-[72px] flex items-center gap-3 px-6 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200/50">
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">public</span>
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">PandaHub</h1>
              <p className="text-[11px] text-slate-500 font-medium">v27.4.0</p>
            </div>
          </Link>
        </div>

        {/* New Repo Button */}
        <div className="px-5 py-6">
          <Link href="/new" className="flex items-center justify-center gap-2 h-10 text-sm bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors no-underline">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Repository
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1">
          {sidebarItems.map(item => {
            const isActive = item.href === repoBase
              ? tab === "Overview"
              : typeof window !== 'undefined' && window.location.pathname === item.href;

            if (item.comingSoon) {
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 cursor-default select-none">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Soon</span>
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                data-tooltip={item.label}
              >
                <span className="material-symbols-outlined icon text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Links */}
        <div className="px-3 pb-6 pt-4 border-t border-slate-100 space-y-1">
          <Link href="/settings" className="sidebar-item">
            <span className="material-symbols-outlined icon text-[20px]">settings</span>
            Settings
          </Link>
          <a
            href="https://github.com/ravitejayadav86/Pandahub/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-item"
          >
            <span className="material-symbols-outlined icon text-[20px]">help_outline</span>
            Support
          </a>
        </div>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* ── Top Header ── */}
        <header className="h-[72px] bg-white border-b border-slate-200/60 sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-bold tracking-tight">
              {owner && repoName ? (
                <>
                  <Link href={`/${owner}`} className="text-slate-500 hover:text-slate-900 transition-colors no-underline">{owner}</Link>
                  <span className="text-slate-300 mx-1">/</span>
                  <Link href={repoBase} className="hover:text-slate-700 transition-colors no-underline">{repoName}</Link>
                </>
              ) : 'PandaHub'}
            </h2>
            <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
              repoMeta?.visibility === 'private'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : repoMeta?.visibility === 'internal'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {repoMeta?.visibility ? repoMeta.visibility.charAt(0).toUpperCase() + repoMeta.visibility.slice(1) : '—'}
            </span>

            {/* Tabs */}
            <div className="flex items-center h-full pt-1 gap-6">
              {["Overview", "Activity", "Stats"].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative h-full flex items-center text-sm font-medium transition-colors ${
                    tab === t ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {t}
                  {tab === t && (
                    <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Link href={`${repoBase}/commits`} title="View commit history" className="text-slate-400 hover:text-slate-700 transition-colors">
              <span className="material-symbols-outlined">history</span>
            </Link>

            {/* Deploy */}
            <button
              title="Deploy this repository"
              onClick={() => setShowDeployModal(true)}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              🚀 Deploy
            </button>

            {/* Profile Dropdown */}
            <div className="relative profile-dropdown-container" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 cursor-pointer hover:ring-2 hover:ring-slate-200 transition-all focus:outline-none flex items-center justify-center bg-slate-100"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-slate-500">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                )}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 py-2 z-50 animate-fade-in-up origin-top-right">
                  <div className="px-4 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-bold text-slate-900">{user?.username || 'user'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email || 'No email'}</p>
                  </div>
                  <div className="px-2 py-1">
                    {[
                      { href: `/${user?.username}`, icon: 'person',      label: 'Your profile' },
                      { href: '/dashboard',         icon: 'code_blocks', label: 'Your repositories' },
                      { href: '/explore',           icon: 'star',        label: 'Explore' },
                    ].map(item => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors no-underline"
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="px-2 py-1 border-t border-slate-100 mt-1">
                    <Link
                      href="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors no-underline"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Dashboard Grid ── */}
        <div className={`p-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-8 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          {/* ━━━ LEFT COLUMN: Profile ━━━ */}
          <div className="space-y-6">

            {/* Profile Card */}
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center relative overflow-hidden group card-lift">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-white pointer-events-none" />

              <div className="w-24 h-24 rounded-full p-1 bg-white shadow-sm border border-slate-100 mb-5 relative z-10 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Owner avatar" className="w-full h-full rounded-full object-cover" />
                ) : user?.avatar_url ? (
                  <img src={user.avatar_url} alt="User avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400">
                    {(owner || user?.username)?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold tracking-tight mb-1 relative z-10">
                {profile?.full_name || owner || user?.username || 'user'}
              </h2>
              <p className="text-slate-500 text-sm mb-4 relative z-10">
                {profile?.bio || user?.email || ''}
              </p>

              {/* Go to profile button */}
              <Link
                href={`/${owner}`}
                className="text-xs font-semibold text-blue-600 hover:underline mb-6 relative z-10"
              >
                View profile →
              </Link>

              {/* Stats row — real data from API */}
              <div className="flex w-full justify-between items-center px-2 relative z-10 pt-6 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xl font-bold">{stat(profile?.repo_count, profileLoading)}</span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Repos</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold">{stat(profile?.follower_count, profileLoading)}</span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Followers</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold">{stat(profile?.following_count, profileLoading)}</span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Following</span>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-lift">
              <h3 className="font-bold mb-4">Quick Links</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Issues',        href: `${repoBase}/issues`,  icon: 'adjust',      color: 'text-red-500' },
                  { label: 'Pull Requests', href: `${repoBase}/pulls`,   icon: 'alt_route',   color: 'text-green-600' },
                  { label: 'Commits',       href: `${repoBase}/commits`, icon: 'commit',      color: 'text-blue-500' },
                  { label: 'File Tree',     href: `${repoBase}/tree`,    icon: 'folder_open', color: 'text-amber-500' },
                  { label: 'Upload files',  href: `${repoBase}/upload`,  icon: 'upload_file', color: 'text-violet-500' },
                ].map(l => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-sm font-medium no-underline"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${l.color}`}>{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ━━━ CENTER COLUMN: Overview Feed ━━━ */}
          <div className="space-y-6">
            {/* Feed Header */}
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight">{tab}</h2>
              <div className="flex items-center gap-2">
                {["All", "Commits", "PRs"].map(f => (
                  <button
                    key={f}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-slate-100 text-slate-900 hover:bg-slate-200"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty state with working CTA */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center flex flex-col items-center card-lift">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">notifications_paused</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No recent activity</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                  There hasn&apos;t been any activity in this repository yet. Push some code or open an issue to get started!
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href={`${repoBase}/issues`}
                    className="px-5 py-2.5 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition-all shadow-sm no-underline"
                  >
                    Open an Issue
                  </Link>
                  <Link
                    href={`${repoBase}/pulls`}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-50 transition-all shadow-sm no-underline"
                  >
                    New Pull Request
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ━━━ RIGHT COLUMN: Trending ━━━ */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-lift">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">trending_up</span>
                Repository Info
              </h3>

              <div className="space-y-4">
                {[
                  {
                    label: 'Clone',
                    icon: 'content_copy',
                    action: () => navigator.clipboard.writeText(
                      `${window.location.protocol}//${window.location.host}/git/${owner}/${repoName}.git`
                    ),
                    color: 'text-blue-500',
                  },
                  {
                    label: 'Download ZIP',
                    icon: 'download',
                    action: () => alert('ZIP download coming soon'),
                    color: 'text-green-600',
                  },
                  {
                    label: 'Watch',
                    icon: 'visibility',
                    action: () => alert('Watch feature coming soon'),
                    color: 'text-amber-500',
                  },
                  {
                    label: starring
                      ? 'Unstar'
                      : `Star${repoMeta ? ` (${repoMeta.star_count})` : ''}`,
                    icon: 'star',
                    action: async () => {
                      if (!user) { router.push('/login'); return; }
                      try {
                        setStarring(true);
                        if (repoMeta && repoMeta.star_count > 0) {
                          await api.delete(`/${owner}/${repoName}/star`);
                          setRepoMeta(m => m ? { ...m, star_count: Math.max(0, m.star_count - 1) } : m);
                        } else {
                          const { data } = await api.post(`/${owner}/${repoName}/star`);
                          setRepoMeta(m => m ? { ...m, star_count: (data as any).star_count } : m);
                        }
                      } finally {
                        setStarring(false);
                      }
                    },
                    color: 'text-yellow-500',
                  },
                  {
                    label: `Fork${repoMeta ? ` (${repoMeta.fork_count})` : ''}`,
                    icon: 'fork_right',
                    action: async () => {
                      if (!user) { router.push('/login'); return; }
                      try {
                        const { data } = await api.post<{ name: string }>(`/${owner}/${repoName}/fork`);
                        router.push(`/${user.username}/${data.name}`);
                      } catch (e: any) {
                        alert(e?.response?.data?.detail || 'Fork failed');
                      }
                    },
                    color: 'text-purple-500',
                  },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-sm font-semibold text-left"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${item.color}`}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Deploy Modal ── */}
      {showDeployModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(1,4,9,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 999, padding: 16, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeployModal(false); }}
        >
          <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
            padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 8px 24px rgba(1,4,9,.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>🚀 Deploy this repository</h3>
              <button onClick={() => setShowDeployModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d8590', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ color: '#7d8590', fontSize: 13, margin: '0 0 20px' }}>
              Choose a platform to deploy <strong style={{ color: '#e6edf3' }}>{owner}/{repoName}</strong>. These services will pull your code directly from the repository.
            </p>

            {[
              {
                name: 'Render',
                desc: 'Web services, workers, databases — auto-deploy on push',
                color: '#46E3B7',
                bg: '#1a2e2a',
                icon: '▲',
                url: `https://render.com/deploy`,
              },
              {
                name: 'Railway',
                desc: 'Instant deployments with zero config',
                color: '#7B68EE',
                bg: '#1e1a2e',
                icon: '🚂',
                url: `https://railway.app/new`,
              },
              {
                name: 'Vercel',
                desc: 'Frontend & serverless — optimised for Next.js',
                color: '#e6edf3',
                bg: '#1c1c1c',
                icon: '▼',
                url: `https://vercel.com/new`,
              },
            ].map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: p.bg, border: '1px solid #30363d', borderRadius: 6,
                  marginBottom: 10, textDecoration: 'none', transition: 'border-color .15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.color)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363d')}
              >
                <span style={{ fontSize: 24, width: 36, textAlign: 'center', flexShrink: 0 }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: p.color }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#7d8590', marginTop: 2 }}>{p.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d8590">
                  <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
                </svg>
              </a>
            ))}

            <div style={{
              background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
              padding: '12px 14px', marginTop: 16,
            }}>
              <p style={{ color: '#7d8590', fontSize: 12, margin: '0 0 6px', fontWeight: 600 }}>🐼 panda CLI</p>
              <code style={{
                fontFamily: "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
                fontSize: 12, color: '#58a6ff',
              }}>
                panda deploy --repo {owner}/{repoName} --platform render
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}