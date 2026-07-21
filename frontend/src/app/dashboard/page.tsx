"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Settings from '../Settings';
import { useAuthStore } from '@/store/authStore';

export default function GeneratedPage() {
  const { user } = useAuthStore();
  const [isEntering, setIsEntering] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Only play the animation once per session
    if (sessionStorage.getItem('dashboard_animated') === 'true') {
      setIsEntering(false);
      return;
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem('dashboard_animated', 'true');
      setIsEntering(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  if (isEntering) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F9FB] z-[9999] overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] bg-blue-500/10 rounded-full blur-[100px] animate-pulse-ring mix-blend-multiply"></div>
        <div className="absolute bottom-[20%] right-[30%] w-[35vw] h-[35vw] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-ring mix-blend-multiply" style={{ animationDelay: '0.75s' }}></div>
        
        {/* Loader Core */}
        <div className="relative z-10 flex flex-col items-center animate-bounce-in">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#0A84FF] to-[#6d28d9] shadow-[0_0_40px_rgba(10,132,255,0.4)] animate-spin-slow"></div>
            <div className="absolute inset-1 rounded-[24px] bg-white flex items-center justify-center">
              <span className="text-4xl">🐼</span>
            </div>
            {/* Spinning orbital ring */}
            <div className="absolute -inset-4 border border-[#0A84FF]/30 rounded-[36px] animate-[spin_3s_linear_infinite]">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#0A84FF] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#0A84FF]"></div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2 font-display">PandaHub</h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-[#0A84FF] rounded-full animate-spin"></div>
            Initializing Workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-on-surface bg-background font-body transition-colors duration-300 relative animate-fade-in-up flex flex-col">
      {/* Background blobs for Liquid UI */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-container/5 blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/10 blur-[100px] pointer-events-none"></div>

      {/* Global Header */}
      <header className="h-[60px] bg-surface-container-highest/80 backdrop-blur-3xl border-b border-outline-variant/10 flex items-center px-4 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMenuOpen(true)} className="text-on-surface-variant hover:text-on-surface p-1 rounded-md transition-colors"><span className="material-symbols-outlined">menu</span></button>
          <div className="text-on-surface font-black text-xl flex items-center gap-2 tracking-tighter">
            <span className="text-2xl">🐼</span> PandaHub
          </div>
          <div className="hidden md:flex items-center text-sm font-semibold text-on-surface ml-2">Dashboard</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-on-surface-variant text-[18px]">search</span>
            <input type="text" placeholder="Type / to search" className="bg-surface border border-outline-variant/20 rounded-lg py-1.5 pl-9 pr-3 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary w-72 transition-all shadow-sm" />
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <button className="p-1 hover:text-on-surface hover:bg-surface-variant/30 rounded-md transition-all"><span className="material-symbols-outlined text-[20px]">add</span></button>
            <button className="p-1 hover:text-on-surface hover:bg-surface-variant/30 rounded-md transition-all"><span className="material-symbols-outlined text-[20px]">adjust</span></button>
            <button className="p-1 hover:text-on-surface hover:bg-surface-variant/30 rounded-md transition-all"><span className="material-symbols-outlined text-[20px]">alt_route</span></button>
            <button className="p-1 hover:text-on-surface hover:bg-surface-variant/30 rounded-md transition-all"><span className="material-symbols-outlined text-[20px]">inbox</span></button>
            <div className="w-7 h-7 rounded-full overflow-hidden border border-outline-variant/20 ml-2 cursor-pointer shadow-sm bg-surface-container-highest">
              {user?.avatar_url ? (
                <img alt="User Avatar" className="w-full h-full object-cover" src={user.avatar_url} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-on-surface-variant">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)}></div>
          
          {/* Menu Panel */}
          <div className="relative w-80 max-w-[85vw] h-full bg-surface shadow-2xl animate-[slide-in-left_0.3s_ease-out] border-r border-outline-variant/20 flex flex-col">
            <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-lowest">
               <div className="flex items-center gap-2 text-on-surface font-black text-xl tracking-tighter">
                  <span className="text-2xl">🐼</span> PandaHub
               </div>
               <button onClick={() => setIsMenuOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-md hover:bg-surface-variant/50"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
               {/* Navigation Sections */}
               <div>
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-1">Home</h3>
                  <div className="space-y-0.5">
                     <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-container text-on-primary-container font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">dashboard</span> Dashboard</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">account_circle</span> Your profile</a>
                  </div>
               </div>
               
               <div>
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-1">Work</h3>
                  <div className="space-y-0.5">
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">adjust</span> Issues</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">alt_route</span> Pull requests</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">forum</span> Discussions</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">view_kanban</span> Projects</a>
                  </div>
               </div>
               
               <div>
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-1">Code & Automation</h3>
                  <div className="space-y-0.5">
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">code</span> Repositories</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">terminal</span> Codespaces</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">play_circle</span> Actions</a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">inventory_2</span> Packages</a>
                  </div>
               </div>

               <div>
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-1">Organizations</h3>
                  <div className="space-y-0.5">
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors">
                       <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-500 border border-blue-500/20 flex items-center justify-center text-xs font-bold">D</span> DevOS
                     </a>
                     <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors">
                       <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-500 border border-purple-500/20 flex items-center justify-center text-xs font-bold">U</span> UI Labs
                     </a>
                  </div>
               </div>
            </div>
            
            <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest">
               <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-on-surface font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">settings</span> Settings</a>
               <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-variant/50 text-error font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[18px]">logout</span> Sign out</a>
            </div>
          </div>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column (Sidebar) */}
        <aside className="lg:col-span-3 space-y-6 hidden lg:block self-start sticky top-[84px] h-[calc(100vh-84px)] overflow-y-auto overscroll-contain custom-scrollbar pb-10">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-outline-variant/20 bg-surface-container-highest">
              {user?.avatar_url ? (
                <img alt="User Avatar" className="w-full h-full object-cover" src={user.avatar_url} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-on-surface-variant">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <span className="font-semibold text-sm text-on-surface">{user?.username || 'user'}</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant cursor-pointer hover:text-on-surface ml-auto">expand_more</span>
          </div>

          <div className="pt-2 border-t border-outline-variant/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-on-surface">Top repositories</h2>
              <a href="/new" className="bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm shadow-primary/20">
                <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: '"FILL" 1'}}>book</span> New
              </a>
            </div>

            <div className="relative mb-3">
              <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-on-surface-variant text-[16px]">search</span>
              <input type="text" placeholder="Find a repository..." className="w-full bg-surface border border-outline-variant/20 rounded-lg py-1.5 pl-8 pr-3 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary transition-colors shadow-sm" />
            </div>

            <div className="space-y-1">
              <div className="py-8 px-4 text-center border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest/50">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 mb-2">inventory_2</span>
                <p className="text-sm font-medium text-on-surface-variant">No repositories yet</p>
                <p className="text-xs text-on-surface-variant/70 mt-1 mb-3">Create your first repository to get started.</p>
                <Link href="/new" className="text-xs font-semibold text-primary hover:text-primary-fixed transition-colors">
                  Create repository →
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Column (Feed) */}
        <div className="lg:col-span-6 space-y-6 pb-20">
          <h1 className="text-2xl font-bold font-headline text-on-surface">Home</h1>

          {/* AI Ask Box */}
          <div className="glass-panel border border-outline-variant/20 rounded-2xl overflow-hidden shadow-md">
            <div className="p-5 border-b border-outline-variant/10 bg-surface-container-lowest/50">
              <input type="text" placeholder="Ask anything or type @ to add context" className="w-full bg-transparent outline-none text-lg text-on-surface placeholder-on-surface-variant/50 font-medium" />
            </div>
            <div className="p-3 bg-surface/50 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <button className="px-3 py-1.5 bg-surface-variant/50 hover:bg-surface-variant border border-outline-variant/10 rounded-lg text-sm flex items-center gap-1 font-medium text-on-surface transition-colors">
                   <span className="material-symbols-outlined text-[16px]">chat</span> Ask <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
                 </button>
                 <button className="px-3 py-1.5 bg-transparent hover:bg-surface-variant/50 rounded-lg text-sm flex items-center gap-1 font-medium text-on-surface-variant hover:text-on-surface transition-colors">
                   <span className="material-symbols-outlined text-[16px]">book</span> All repositories <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
                 </button>
                 <button className="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-surface-variant/50 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                   <span className="material-symbols-outlined text-[18px]">add</span>
                 </button>
              </div>
              <div className="flex items-center gap-3">
                 <button className="text-sm font-medium flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors">
                   <span className="material-symbols-outlined text-[16px]">group</span> Auto
                 </button>
                 <div className="w-px h-4 bg-outline-variant/20"></div>
                 <button className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center">
                   <span className="material-symbols-outlined text-[18px]">history</span>
                 </button>
                 <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
                   <span className="material-symbols-outlined text-[18px]">send</span>
                 </button>
              </div>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/20 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-surface-variant hover:border-outline-variant/40 hover:-translate-y-0.5 transition-all text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span> Agent
            </button>
            <button className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/20 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-surface-variant hover:border-outline-variant/40 hover:-translate-y-0.5 transition-all text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-error">adjust</span> Create issue
            </button>
            <button className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/20 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-surface-variant hover:border-outline-variant/40 hover:-translate-y-0.5 transition-all text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-tertiary">code</span> Write code <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
            </button>
            <button className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/20 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-surface-variant hover:border-outline-variant/40 hover:-translate-y-0.5 transition-all text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-orange-500">terminal</span> Git <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
            </button>
            <button className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/20 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-surface-variant hover:border-outline-variant/40 hover:-translate-y-0.5 transition-all text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-green-500">alt_route</span> Pull requests <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
            </button>
          </div>

          {/* Feed */}
          <div className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-on-surface">Feed</h2>
              <button className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant border border-outline-variant/10 text-sm font-medium flex items-center gap-1.5 text-on-surface transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[16px]">filter_list</span> Filter
              </button>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-10 border border-outline-variant/10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center text-on-surface-variant/50 mb-4 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">notifications_paused</span>
                </div>
                <h3 className="text-lg font-bold font-headline text-on-surface mb-2">Activity is quiet</h3>
                <p className="text-sm text-on-surface-variant max-w-sm mb-6">
                  When you star repositories, follow users, or join organizations, their activity will show up here.
                </p>
                <Link href="/explore" className="px-5 py-2.5 bg-primary-container text-on-primary-container font-semibold text-sm rounded-xl hover:bg-primary-container/90 transition-all shadow-sm">
                  Explore PandaHub
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Widgets) */}
        <aside className="lg:col-span-3 space-y-6 hidden lg:block self-start sticky top-[84px]">
          
          <div className="glass-panel border border-outline-variant/20 rounded-2xl p-6 text-center shadow-sm">
             <span className="text-4xl block mb-3 animate-bounce-in">🐼</span>
             <h3 className="font-bold text-on-surface text-base mb-2">Welcome to PandaHub</h3>
             <p className="text-xs text-on-surface-variant mb-4">
               The platform for modern developers to build, ship, and collaborate.
             </p>
             <div className="text-[10px] font-mono text-outline-variant uppercase tracking-widest px-3 py-1 bg-surface-container rounded-full inline-block border border-outline-variant/10">
               Coming Soon
             </div>
          </div>

        </aside>

      </div>

      <Settings />
    </div>
  );
}