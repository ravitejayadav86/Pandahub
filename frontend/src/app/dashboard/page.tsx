"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GitMerge, CircleDot, Bookmark, Clock, Plus, Rocket } from 'lucide-react'

import { DashboardNav } from './DashboardNav'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Repository } from '@/types'
import { SkeletonBlock, SkeletonPanel } from '@/components/ui/PageSkeleton'
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
  const { user } = useAuthStore()
  const router = useRouter()

  // Real data state
  const [repos, setRepos] = useState<Repository[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [suggestedStartups, setSuggestedStartups] = useState<StartupSuggestion[]>([])



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

  const renderActivityFeed = () => {
    if (activityLoading) {
      return (
        <div role="status" aria-label="Loading activity" className="space-y-3">
          {[0, 1, 2, 3].map((item) => <SkeletonPanel key={item}>
            <div className="ph-sk-row"><SkeletonBlock width={38} height={38} radius={12}/>
              <div className="ph-sk-grow"><SkeletonBlock width="82%" height={14}/><SkeletonBlock width="44%" height={11}/></div>
            </div>
          </SkeletonPanel>)}
        </div>
      )
    }
    if (activity.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center motion--in">
          <Clock className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-700 text-[#475569] mb-1">No recent activity</h3>
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
            <div className="p-2 bg-blue-50 bg-[#E8F9FF] rounded-full text-blue-500 shrink-0">
              <ActivityIcon type={act.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 text-[#475569]">
                <span className="font-semibold text-slate-900 text-[#1F2937]">{act.author}</span>
                {' '}{activityDescription(act.type)}{' '}
                <Link href={`/${act.repo}`} className="font-medium text-blue-600 hover:underline">{act.repo}</Link>
              </p>
              <p className="text-sm font-medium text-slate-900 text-[#1F2937] truncate mt-0.5">{act.title}</p>
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
        <div role="status" aria-label="Loading repositories" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((item) => <SkeletonPanel key={item}>
            <SkeletonBlock width="65%" height={20}/><SkeletonBlock width="92%" height={13}/>
            <SkeletonBlock width="40%" height={12}/>
          </SkeletonPanel>)}
        </div>
      )
    }
    if (repos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center motion--in">
          <Bookmark className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-700 text-[#475569] mb-1">No repositories yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create your first repository to get started.</p>
          <Button variant="primary" className="h-9 text-sm" onClick={() => router.push('/new')}>
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
    <div className="w-full md:w-80 flex flex-col gap-6 shrink-0" style={{ animationDelay: '0.15s' }}>
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
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => router.push(`/startups/${startup.slug}`)}>View</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card variant="default" className="bg-[#E8F9FF] border border-[#C4D9FF]" style={{ backgroundColor: '#E8F9FF', color: '#263449', borderColor: '#C4D9FF', boxShadow: '0 10px 26px rgba(91,109,160,0.08)' }}>
        <CardContent className="p-5 flex flex-col items-start gap-2">
          <div className="p-2 rounded-xl shadow-sm mb-1" style={{ background: '#C5BAFF', border: '1px solid #B8ADEC', color: '#453A76' }}>
            <Rocket className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-800">Upgrade to Pro</h3>
          <p className="text-xs text-slate-600 mb-2">Get advanced AI code reviews and private startup metrics.</p>
          <Button variant="primary" className="w-full text-xs h-8" onClick={() => router.push('/settings')}>View Plans</Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-slate-800">
      <DashboardNav />

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col md:flex-row gap-8 relative z-10">

        <div className="flex-1 flex flex-col min-w-0">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="ph-dashboard-heading">
              <span className="ph-premium-kicker">WORKSPACE OVERVIEW <span aria-hidden="true">✦</span></span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Your dashboard</h1>
              <p>Your code, activity and community in one place.</p>
            </div>
            <Button variant="primary" className="h-9 text-sm" onClick={() => router.push('/new')}>
              <Plus className="w-4 h-4 mr-1" /> New Repository
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.05 }}
            className="mb-6"
          >
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex items-center gap-3 mb-4" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => router.push(repos[0] ? `/${user?.username}/${repos[0].name}/issues` : '/new')}
                  className="px-4 py-2 rounded-full bg-[#E8F9FF] border border-[#C4D9FF] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#C4D9FF] transition-all text-slate-700 whitespace-nowrap"
                >
                  <CircleDot className="w-4 h-4 text-slate-500" /> Create issue
                </button>
                <button
                  onClick={() => router.push(repos[0] ? `/${user?.username}/${repos[0].name}/pulls` : '/new')}
                  className="px-4 py-2 rounded-full bg-[#E8F9FF] border border-[#C4D9FF] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#C4D9FF] transition-all text-slate-700 whitespace-nowrap"
                >
                  <GitMerge className="w-4 h-4 text-slate-500" /> Pull requests
                </button>
                <button
                  onClick={() => router.push('/new')}
                  className="px-4 py-2 rounded-full bg-[#E8F9FF] border border-[#C4D9FF] shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-[#C4D9FF] transition-all text-slate-700 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 text-slate-500" /> New repository
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