"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from '@/store/authStore';
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

export default function RepoDashboardPage() {
  const { user } = useAuthStore();
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org ?? '';
  const repoName = params?.repo ?? '';

  const [tab, setTab] = useState("Overview");
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Real user profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.remove('dark');
  }, []);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileOpen && !(event.target as Element).closest('.profile-dropdown-container')) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  // Stat display helper — shows skeleton dashes while loading
  const stat = (value: number | undefined, loading: boolean) =>
    loading ? <span style={{ color: '#cbd5e1' }}>—</span> : value ?? 0;

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans antialiased overflow-x-hidden flex">

      {/* ── Sticky Sidebar ── */}
      <aside className="self-start sticky top-0 h-screen w-[260px] shrink-0 bg-white border-r border-slate-200/60 z-50 flex flex-col overflow-y-auto overscroll-contain scroll-smooth hidden md:flex transition-all duration-300 hover:shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* Logo */}
        <div className="h-[72px] flex items-center gap-3 px-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-200/50">
            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px]">public</span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">PandaHub</h1>
            <p className="text-[11px] text-slate-500 font-medium">v27.4.0</p>
          </div>
        </div>

        {/* New Repo Button */}
        <div className="px-5 py-6">
          <button className="btn-primary btn-ripple w-full flex items-center justify-center gap-2 h-10 text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Repository
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1 stagger-children">
          {[
            { id: "dashboard", label: "Dashboard",     icon: "grid_view",    active: true  },
            { id: "code",      label: "Code",          icon: "code",         active: false },
            { id: "commits",   label: "Commits",       icon: "commit",       active: false },
            { id: "issues",    label: "Issues",        icon: "adjust",       active: false },
            { id: "prs",       label: "Pull Requests", icon: "alt_route",    active: false },
            { id: "actions",   label: "Actions",       icon: "play_circle",  active: false },
            { id: "projects",  label: "Projects",      icon: "kanban",       active: false },
            { id: "wiki",      label: "Wiki",          icon: "menu_book",    active: false },
            { id: "security",  label: "Security",      icon: "security",     active: false },
            { id: "insights",  label: "Insights",      icon: "insights",     active: false },
            { id: "market",    label: "Marketplace",   icon: "shopping_bag", active: false },
          ].map(item => (
            <a key={item.id} href="#"
              className={`sidebar-item ${item.active ? 'active' : ''}`}
              data-tooltip={item.label}
            >
              <span className="material-symbols-outlined icon text-[20px]">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Bottom Links */}
        <div className="px-3 pb-6 pt-4 border-t border-slate-100 space-y-1">
          <a href="#" className="sidebar-item">
            <span className="material-symbols-outlined icon text-[20px]">settings</span>
            Settings
          </a>
          <a href="#" className="sidebar-item">
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
              {owner && repoName ? `${owner}/${repoName}` : 'PandaHub'}
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">Public</span>

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
            <button className="text-slate-400 hover:text-slate-700 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-slate-400 hover:text-slate-700 transition-colors">
              <span className="material-symbols-outlined">history</span>
            </button>
            <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm">
              Deploy
            </button>

            {/* Profile Dropdown Container */}
            <div className="relative profile-dropdown-container">
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
                    <a href="#" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                      Your profile
                    </a>
                    <a href="#" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">code_blocks</span>
                      Your repositories
                    </a>
                    <a href="#" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">star</span>
                      Your stars
                    </a>
                  </div>
                  <div className="px-2 py-1 border-t border-slate-100 mt-1">
                    <a href="#" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      Settings
                    </a>
                    <a href="#" className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign out
                    </a>
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
              <p className="text-slate-500 text-sm mb-8 relative z-10">
                {profile?.bio || user?.email || ''}
              </p>

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

            {/* Recent Activity Mini-card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Recent Activity</h3>
                <a href="#" className="text-blue-500"><span className="material-symbols-outlined text-[16px]">open_in_new</span></a>
              </div>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">notifications_paused</span>
                </div>
                <p className="text-xs text-slate-500">No recent activity yet.</p>
                <p className="text-xs text-slate-400 mt-1">Push code or open an issue to get started.</p>
              </div>
            </div>

          </div>

          {/* ━━━ CENTER COLUMN: Overview Feed ━━━ */}
          <div className="space-y-6">

            {/* Feed Header */}
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-slate-100 text-slate-900 rounded-lg text-xs font-bold transition-colors">All</button>
                <button className="px-3 py-1.5 text-slate-500 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors">Commits</button>
                <button className="px-3 py-1.5 text-slate-500 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors">PRs</button>
              </div>
            </div>

            {/* Feed Cards — empty state (real data when commits integrated) */}
            <div className="space-y-6 stagger-children">
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center flex flex-col items-center card-lift">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">notifications_paused</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No recent activity</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                  There hasn't been any activity in this repository yet. Push some code or open an issue to get started!
                </p>
                <button className="px-5 py-2.5 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition-all shadow-sm">
                  View Setup Instructions
                </button>
              </div>
            </div>
          </div>

          {/* ━━━ RIGHT COLUMN: Trending ━━━ */}
          <div className="space-y-6">

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] card-lift">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">trending_up</span>
                Trending
              </h3>

              <div className="space-y-6 stagger-children">
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-slate-400 text-xl">star_border</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No trending repos</p>
                  <p className="text-xs text-slate-500">Star repositories to see them here</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}