"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { LayoutDashboard, GitMerge, CircleDot, Rocket, Bookmark, Clock, Plus, X } from 'lucide-react'

import { DashboardNav } from './DashboardNav'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'

// ----------------------------------------------------------------------
// Mock Data (until backend feed endpoints are fully implemented)
// ----------------------------------------------------------------------
const MOCK_REPOS = [
  { id: '1', name: 'pandahub/core', description: 'The core backend written in FastAPI', language: 'Python', stars: 12 },
  { id: '2', name: 'pandahub/frontend', description: 'Next.js web interface', language: 'TypeScript', stars: 8 },
  { id: '3', name: 'ravit/personal-website', description: 'My portfolio site', language: 'TypeScript', stars: 2 },
]

const MOCK_ACTIVITY = [
  { id: '101', type: 'pr_opened', repo: 'pandahub/core', title: 'feat: implement module 11', timeDisplay: '30 minutes ago', author: 'ravit' },
  { id: '102', type: 'issue_closed', repo: 'pandahub/frontend', title: 'Fix glassmorphism blur on Safari', timeDisplay: '2 hours ago', author: 'ravit' },
  { id: '103', type: 'pr_merged', repo: 'pandahub/core', title: 'feat: implement module 10', timeDisplay: '5 hours ago', author: 'ravit' },
]

const MOCK_STARTUPS = [
  { id: 's1', name: 'AeroSpace.ai', tags: ['AI', 'Aerospace'] },
  { id: 's2', name: 'FinFlow', tags: ['Fintech', 'React'] },
]

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore();
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

  // If loading animation is active
  if (isEntering) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F9FB] dark:bg-[#0f172a] z-[9999] overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] bg-blue-500/10 rounded-full blur-[100px] animate-pulse-ring mix-blend-multiply"></div>
        <div className="absolute bottom-[20%] right-[30%] w-[35vw] h-[35vw] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-ring mix-blend-multiply" style={{ animationDelay: '0.75s' }}></div>
        
        {/* Loader Core */}
        <div className="relative z-10 flex flex-col items-center animate-bounce-in">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#0A84FF] to-[#6d28d9] shadow-[0_0_40px_rgba(10,132,255,0.4)] animate-spin-slow"></div>
            <div className="absolute inset-1 rounded-[24px] bg-white dark:bg-slate-900 flex items-center justify-center">
              <span className="text-4xl">🐼</span>
            </div>
            {/* Spinning orbital ring */}
            <div className="absolute -inset-4 border border-[#0A84FF]/30 rounded-[36px] animate-[spin_3s_linear_infinite]">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#0A84FF] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#0A84FF]"></div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 font-display">PandaHub</h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-[#0A84FF] rounded-full animate-spin"></div>
            Initializing Workspace...
          </div>
        </div>
      </div>
    );
  }

  // Slide-out Menu Overlay
  const renderSlideOutMenu = () => (
    isMenuOpen && (
      <div className="fixed inset-0 z-[100] flex">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)}></div>
        
        {/* Menu Panel */}
        <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl animate-[slide-in-left_0.3s_ease-out] border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
             <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-xl tracking-tighter">
                <span className="text-2xl">🐼</span> PandaHub
             </div>
             <button onClick={() => setIsMenuOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
               <X className="w-5 h-5" />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
             {/* Navigation Sections */}
             <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Home</h3>
                <div className="space-y-1">
                   <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium text-sm transition-colors">
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </Link>
                   <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors">
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-300" />}
                    </div> 
                    Your profile
                   </Link>
                </div>
             </div>
             
             <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Work</h3>
                <div className="space-y-1">
                   <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors">
                    <CircleDot className="w-4 h-4" /> Issues
                   </Link>
                   <Link href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors">
                    <GitMerge className="w-4 h-4" /> Pull requests
                   </Link>
                </div>
             </div>
          </div>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
             <button onClick={clearAuth} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-sm transition-colors">
               Sign out
             </button>
          </div>
        </div>
      </div>
    )
  )

  const renderSidebar = () => (
    <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 animate-fade-in-up">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-3">Menu</div>
      
      <Button variant="ghost" className="justify-start text-slate-700 font-medium bg-slate-100 dark:bg-slate-800 dark:text-slate-200">
        <LayoutDashboard className="w-4 h-4 mr-2" /> Home
      </Button>
      <Button variant="ghost" className="justify-start text-slate-500 hover:text-slate-700">
        <CircleDot className="w-4 h-4 mr-2" /> Issues
      </Button>
      <Button variant="ghost" className="justify-start text-slate-500 hover:text-slate-700">
        <GitMerge className="w-4 h-4 mr-2" /> Pull Requests
      </Button>
      <Button variant="ghost" className="justify-start text-slate-500 hover:text-slate-700">
        <Rocket className="w-4 h-4 mr-2" /> Startup Hub
      </Button>

      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-3">Pinned</div>
      <Button variant="ghost" className="justify-start text-slate-600 text-sm py-1.5 h-auto">
        <Bookmark className="w-3.5 h-3.5 mr-2 text-slate-400" /> pandahub/core
      </Button>
      <Button variant="ghost" className="justify-start text-slate-600 text-sm py-1.5 h-auto">
        <Bookmark className="w-3.5 h-3.5 mr-2 text-slate-400" /> pandahub/frontend
      </Button>
    </div>
  )

  const renderActivityFeed = () => (
    <div className="space-y-4">
      {MOCK_ACTIVITY.map((act, i) => (
        <Card 
          key={act.id} 
          variant="glass-panel" 
          interactive="glow" 
          className="flex flex-row items-center gap-4 p-4 animate-fade-in-up"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-500 shrink-0">
            {act.type.includes('pr') ? <GitMerge className="w-5 h-5" /> : <CircleDot className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{act.author}</span>
              {' '}
              {act.type === 'pr_opened' && 'opened a pull request in'}
              {act.type === 'pr_merged' && 'merged a pull request in'}
              {act.type === 'issue_closed' && 'closed an issue in'}
              {' '}
              <Link href={`/${act.repo}`} className="font-medium text-blue-600 hover:underline">{act.repo}</Link>
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate mt-0.5">
              {act.title}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {act.timeDisplay}
            </p>
          </div>
        </Card>
      ))}
      <Button variant="ghost" className="w-full mt-4 text-blue-600">View All Activity</Button>
    </div>
  )

  const renderRepos = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
      {MOCK_REPOS.map((repo, i) => (
        <Card 
          key={repo.id} 
          variant="default" 
          interactive="lift"
          style={{ animationDelay: `${i * 0.05}s` }}
          className="animate-fade-in-up p-5"
        >
          <div className="flex justify-between items-start mb-2">
            <Link href={`/${repo.name}`} className="font-semibold text-blue-600 hover:underline text-lg truncate">
              {repo.name}
            </Link>
            <Badge variant="default" className="text-[10px] uppercase">Public</Badge>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">
            {repo.description}
          </p>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              {repo.language}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
              {repo.stars}
            </span>
          </div>
        </Card>
      ))}
    </div>
  )

  const renderWidgets = () => (
    <div className="w-full md:w-80 flex flex-col gap-6 shrink-0 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <Card variant="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Suggested Startups
            <Badge variant="purple">Hub</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MOCK_STARTUPS.map(startup => (
            <div key={startup.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Avatar size="sm" fallback={startup.name.charAt(0)} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold group-hover:text-blue-600 transition-colors cursor-pointer">{startup.name}</span>
                  <span className="text-xs text-slate-500">{startup.tags.join(', ')}</span>
                </div>
              </div>
              <Button variant="ghost" className="h-7 px-2 text-xs">Follow</Button>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card variant="default" className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border-blue-100 dark:border-slate-700">
        <CardContent className="p-5 flex flex-col items-start gap-2">
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm mb-1">
            <Rocket className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Upgrade to Pro</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Get advanced AI code reviews and private startup metrics.</p>
          <Button variant="primary" className="w-full text-xs h-8">View Plans</Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#0f172a]">
      {renderSlideOutMenu()}
      <DashboardNav onMenuClick={() => setIsMenuOpen(true)} />
      
      {/* Background ambient light */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/5 blur-[100px] pointer-events-none" />

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col md:flex-row gap-8 relative z-10">
        
        {/* Left Sidebar */}
        {renderSidebar()}
        
        {/* Center Feed */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
            <Button variant="primary" className="h-9 text-sm">
              <Plus className="w-4 h-4 mr-1" /> New Repository
            </Button>
          </div>
          
          {/* Action Pills & Ask AI Section (From Original) */}
          <div className="mb-6 animate-fade-in-up">
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <button className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200">
                <CircleDot className="w-4 h-4 text-red-500" /> Create issue
              </button>
              <button className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200">
                <GitMerge className="w-4 h-4 text-green-500" /> Pull requests
              </button>
            </div>
          </div>

          <Tabs 
            className="w-full"
            tabs={[
              { id: 'activity', label: 'Activity Feed', content: renderActivityFeed() },
              { id: 'repos', label: 'Your Repositories', content: renderRepos() }
            ]}
          />
        </div>

        {/* Right Widgets */}
        <div className="hidden lg:block">
          {renderWidgets()}
        </div>
      </main>
    </div>
  )
}