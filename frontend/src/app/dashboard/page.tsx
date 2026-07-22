"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { LayoutDashboard, GitMerge, CircleDot, Rocket, Bookmark, Clock, Plus } from 'lucide-react'

import { DashboardNav } from './DashboardNav'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'

// ----------------------------------------------------------------------
// Mock Data (until backend feed endpoints are fully implemented)
// ----------------------------------------------------------------------
const MOCK_REPOS = [
  { id: '1', name: 'pandahub/core', description: 'The core backend written in FastAPI', language: 'Python', stars: 12 },
  { id: '2', name: 'pandahub/frontend', description: 'Next.js web interface', language: 'TypeScript', stars: 8 },
  { id: '3', name: 'ravit/personal-website', description: 'My portfolio site', language: 'TypeScript', stars: 2 },
]

const MOCK_ACTIVITY = [
  { id: '101', type: 'pr_opened', repo: 'pandahub/core', title: 'feat: implement module 11', time: new Date(Date.now() - 1000 * 60 * 30), author: 'ravit' },
  { id: '102', type: 'issue_closed', repo: 'pandahub/frontend', title: 'Fix glassmorphism blur on Safari', time: new Date(Date.now() - 1000 * 60 * 60 * 2), author: 'ravit' },
  { id: '103', type: 'pr_merged', repo: 'pandahub/core', title: 'feat: implement module 10', time: new Date(Date.now() - 1000 * 60 * 60 * 5), author: 'ravit' },
]

const MOCK_STARTUPS = [
  { id: 's1', name: 'AeroSpace.ai', tags: ['AI', 'Aerospace'] },
  { id: 's2', name: 'FinFlow', tags: ['Fintech', 'React'] },
]

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------
export default function DashboardPage() {
  
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
              <Clock className="w-3 h-3" /> {formatDistanceToNow(act.time, { addSuffix: true })}
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
      <DashboardNav />
      
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