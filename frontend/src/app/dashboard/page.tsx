"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, GitMerge, CircleDot, Rocket, Bookmark, Clock, Plus, X, AlertCircle } from 'lucide-react'

import { DashboardNav } from './DashboardNav'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Repository } from '@/types'
import PandaLoader from '@/components/ui/PandaLoader'
import { motion } from 'framer-motion'

// Activity event shape returned by GET /auth/me/activity
interface ActivityEvent {
  id: string
  type: 'pr_opened' | 'pr_merged' | 'issue_opened' | 'issue_closed'
  title: string
  repo: string
  author: string
  created_at: string
}

// Startup shape returned by GET /startups
interface StartupSuggestion {
  id: string
  name: string
  slug: string
  stage: string
}

// Relative time helper (no external dependency)
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function ActivityIcon({ type }: { type: string }) {
  return type.includes('pr')
    ? <GitMerge className="w-5 h-5" />
    : <CircleDot className="w-5 h-5" />
}

function activityDescription(type: string): string {
  if (type === 'pr_opened') return 'opened a pull request in'
  if (type === 'pr_merged') return 'merged a pull request in'
  if (type === 'issue_opened') return 'opened an issue in'
  if (type === 'issue_closed') return 'closed an issue in'
  return 'acted in'
}

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()
  const [isEntering, setIsEntering] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Real data state
  const [repos, setRepos] = useState<Repository[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [suggestedStartups, setSuggestedStartups] = useState<StartupSuggestion[]>([])


  useEffect(() => {
    if (sessionStorage.getItem('dashboard_animated') === 'true') {
      setIsEntering(false)
      return
    }
    const timer = setTimeout(() => {
      sessionStorage.setItem('dashboard_animated', 'true')
      setIsEntering(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMenuOpen])

  // Fetch user's repos
  useEffect(() => {
    const fetchRepos = async () => {
      setReposLoading(true)
      try {
        const { data } = await api.get<Repository[]>('/auth/me/repos', { params: { limit: 6 } })
        setRepos(data)
      } catch {
        setRepos([])
      }
      setReposLoading(false)
    }
    fetchRepos()
  }, [])

  // Fetch activity feed
  useEffect(() => {
    const fetchActivity = async () => {
      setActivityLoading(true)
      try {
        const { data } = await api.get<ActivityEvent[]>('/auth/me/activity', { params: { limit: 10 } })
        setActivity(data)
      } catch {
        setActivity([])
      }
      setActivityLoading(false)
    }
    fetchActivity()
  }, [])

  // Fetch suggested startups (first 3, any stage)
  useEffect(() => {
    const fetchStartups = async () => {
      try {
        const { data } = await api.get<StartupSuggestion[]>('/startups', { params: { limit: 3 } })
        setSuggestedStartups(data)
      } catch {
        setSuggestedStartups([])
      }
    }
    fetchStartups()
  }, [])

  if (isEntering) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F9FB] dark:bg-[#0f172a] z-[9999] overflow-hidden">
        {/* Static ambient background — zero GPU cost, same premium look */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-blue-500/6 -[80px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-500/6 -[80px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center motion- p-8 rounded-3xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
          <PandaLoader size="xl" glow={true} label="Initializing Workspace..." />
        </div>
      </div>
    )
  }

  const renderSlideOutMenu = () => (
    isMenuOpen && (
      <div className="fixed inset-0 z-[100] flex">
        <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={() => setIsMenuOpen(false)}></div>
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
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Home</h3>
              <div className="space-y-1">
                <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium text-sm transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Work</h3>
              <div className="space-y-1">
                <button onClick={() => { setIsMenuOpen(false); router.push(repos[0] ? `/${user?.username}/${repos[0].name}/issues` : '/new') }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors">
                  <CircleDot className="w-4 h-4" /> Issues
                </button>
                <button onClick={() => { setIsMenuOpen(false); router.push(repos[0] ? `/${user?.username}/${repos[0].name}/pulls` : '/new') }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors">
                  <GitMerge className="w-4 h-4" /> Pull requests
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <button onClick={() => { clearAuth(); router.push('/'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-sm transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  )

  const renderSidebar = () => {
    const navItems = [
      { id: 'home', label: 'Home', icon: LayoutDashboard, path: '/dashboard', active: true },
      { id: 'issues', label: 'Issues', icon: CircleDot, path: repos[0] ? `/${user?.username}/${repos[0].name}/issues` : '/new' },
      { id: 'pulls', label: 'Pull Requests', icon: GitMerge, path: repos[0] ? `/${user?.username}/${repos[0].name}/pulls` : '/new' },
      { id: 'startups', label: 'Startup Hub', icon: Rocket, path: '/startups' },
    ];

    return (
      <div className="hidden md:flex flex-col shrink-0 w-20 sticky top-24">
        <div className="flex flex-col items-center gap-4 py-6 bg-[#0a0a0c] border border-[#27272a] rounded-[2rem] shadow-xl">
          {navItems.map((item) => (
            <div key={item.id} className="relative group flex items-center justify-center w-full">
              {/* Tooltip */}
              <div className="absolute left-16 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {item.label}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#1a1a1a] border-b border-l border-white/10 rotate-45" />
              </div>

              <motion.button
                onClick={() => router.push(item.path)}
                whileHover={{ scale: 1.15, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-colors duration-200 ${
                  item.active 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'bg-[#18181b] text-zinc-400 border border-[#333333] hover:text-white hover:bg-[#27272a]'
                }`}
              >
                <item.icon className="w-5 h-5" />
              </motion.button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderActivityFeed = () => {
    if (activityLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <PandaLoader size="md" glow={true} label="Loading activity..." />
        </div>
      )
    }
    if (activity.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center motion--in">
          <Clock className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No recent activity</h3>
          <p className="text-sm text-slate-500">Push code, open issues, or create pull requests to see your activity here.</p>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {activity.map((act, i) => (
          <Card
            key={act.id}
            variant="glass-panel"
            interactive="glow"
            className={`flex flex-row items-center gap-4 p-4 card-motion- motion-stagger-${Math.min(i+1, 8)}`}
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-500 shrink-0">
              <ActivityIcon type={act.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">{act.author}</span>
                {' '}{activityDescription(act.type)}{' '}
                <Link href={`/${act.repo}`} className="font-medium text-blue-600 hover:underline">{act.repo}</Link>
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate mt-0.5">{act.title}</p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeAgo(act.created_at)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const renderRepos = () => {
    if (reposLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <PandaLoader size="md" glow={true} label="Loading repositories..." />
        </div>
      )
    }
    if (repos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center motion--in">
          <Bookmark className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No repositories yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create your first repository to get started.</p>
          <Button variant="primary" className="h-9 text-sm" onClick={() => window.location.href = '/new'}>
            <Plus className="w-4 h-4 mr-1" /> New Repository
          </Button>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {repos.map((repo, i) => (
          <Card
            key={repo.id}
            variant="default"
            interactive="lift"
            className={`card-motion- motion-stagger-${Math.min(i+1, 8)} p-5`}
          >
            <div className="flex justify-between items-start mb-2">
              <Link href={`/${repo.owner_username || user?.username}/${repo.name}`} className="font-semibold text-blue-600 hover:underline text-lg truncate">
                {repo.name}
              </Link>
              <Badge variant="default" className="text-[10px] uppercase">{repo.visibility}</Badge>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">
              {repo.description || 'No description.'}
            </p>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
                {repo.star_count}
              </span>
              <span className="flex items-center gap-1">🔀 {repo.fork_count}</span>
              <span className="ml-auto text-slate-400">{new Date(repo.updated_at).toLocaleDateString()}</span>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const renderWidgets = () => (
    <div className="w-full md:w-80 flex flex-col gap-6 shrink-0 motion-" style={{ animationDelay: '0.15s' }}>
      <Card variant="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Suggested Startups
            <Badge variant="purple">Hub</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestedStartups.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              No startups yet. <Link href="/startups" className="text-blue-500 hover:underline">Be the first!</Link>
            </p>
          ) : (
            suggestedStartups.map(startup => (
              <div key={startup.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <Avatar size="sm" fallback={startup.name.charAt(0)} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold group-hover:text-blue-600 transition-colors cursor-pointer">{startup.name}</span>
                    <span className="text-xs text-slate-500">{startup.stage.replace('_', ' ')}</span>
                  </div>
                </div>
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => window.location.href = `/startups/${startup.slug}`}>View</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card variant="default" className="bg-[#121214] border border-[#27272a]">
        <CardContent className="p-5 flex flex-col items-start gap-2">
          <div className="p-2 bg-[#18181b] border border-[#333333] rounded-xl shadow-sm mb-1">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-white">Upgrade to Pro</h3>
          <p className="text-xs text-zinc-400 mb-2">Get advanced AI code reviews and private startup metrics.</p>
          <Button variant="primary" className="w-full text-xs h-8" onClick={() => router.push('/settings')}>View Plans</Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      {renderSlideOutMenu()}
      <DashboardNav onMenuClick={() => setIsMenuOpen(true)} />

      {/* Ambient gradient background — static, zero GPU cost */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-white/[0.02] blur-[120px] -[80px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-white/[0.015] blur-[120px] -[80px]" />
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col md:flex-row gap-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {renderSidebar()}
        </motion.div>

        <div className="flex-1 flex flex-col min-w-0">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold tracking-tight text-white motion-">Dashboard</h1>
            <Button variant="primary" className="h-9 text-sm" onClick={() => window.location.href = '/new'}>
              <Plus className="w-4 h-4 mr-1" /> New Repository
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.05 }}
            className="mb-6 motion-"
          >
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex items-center gap-3 mb-4" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => router.push(repos[0] ? `/${user?.username}/${repos[0].name}/issues` : '/new')}
                  className="px-4 py-2 rounded-full bg-[#18181b] border border-[#333333] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#27272a] transition-all text-white whitespace-nowrap"
                >
                  <CircleDot className="w-4 h-4 text-zinc-300" /> Create issue
                </button>
                <button
                  onClick={() => router.push(repos[0] ? `/${user?.username}/${repos[0].name}/pulls` : '/new')}
                  className="px-4 py-2 rounded-full bg-[#18181b] border border-[#333333] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#27272a] transition-all text-white whitespace-nowrap"
                >
                  <GitMerge className="w-4 h-4 text-zinc-300" /> Pull requests
                </button>
                <button
                  onClick={() => router.push('/new')}
                  className="px-4 py-2 rounded-full bg-[#18181b] border border-[#333333] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#27272a] transition-all text-white whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 text-zinc-300" /> New repository
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
          >
            <Tabs
              className="w-full"
              tabs={[
                { id: 'activity', label: 'Activity Feed', content: renderActivityFeed() },
                { id: 'repos', label: 'Your Repositories', content: renderRepos() }
              ]}
            />
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
          className="hidden lg:block"
        >
          {renderWidgets()}
        </motion.div>
      </main>
    </div>
  )
}