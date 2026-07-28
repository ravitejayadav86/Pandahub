'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { 
  MapPin, Link as LinkIcon, Calendar, BookMarked, GitMerge, Star, Users, 
  Smile, Search, ChevronDown, Activity, Package, Layout, Book, Trophy, Hexagon
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/shared/Navbar'

// ── Types ──────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string
  username: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  location: string | null
  website_url: string | null
  is_verified: boolean
  created_at: string | null
  repo_count: number
}

interface Repository {
  id: string
  name: string
  description: string | null
  star_count: number
  fork_count: number
  primary_language: string | null
  updated_at: string
  visibility?: 'PUBLIC' | 'PRIVATE'
}

type TabType = 'overview' | 'repositories' | 'projects' | 'packages' | 'stars'

// ── Component ──────────────────────────────────────────────────────────────
export default function UserProfilePage() {
  const params = useParams()
  const org = params.org as string
  const { user: currentUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [repoSearch, setRepoSearch] = useState('')
  
  useEffect(() => {
    if (!org) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: profileData } = await api.get<UserProfile>(`/auth/users/${org}`)
        setProfile(profileData)

        if (currentUser && currentUser.username === org) {
          const { data: reposData } = await api.get<Repository[]>('/auth/me/repos')
          setRepos(reposData)
        } else {
          const { data: reposData } = await api.get<Repository[]>('/explore/repos', { params: { q: org } })
          const filtered = reposData.filter((r: any) => r.owner_username === org)
          setRepos(filtered)
        }
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [org, currentUser])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4">404</h1>
          <p className="text-slate-500 mb-6">User not found.</p>
          <Link href="/dashboard" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  const isOwner = currentUser && currentUser.username === profile.username
  
  // Repo filtering
  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()))
  const pinnedRepos = repos.sort((a, b) => b.star_count - a.star_count).slice(0, 6)

  // ── Tabs rendering ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Overview', icon: Book },
    { id: 'repositories', label: 'Repositories', icon: BookMarked, count: repos.length },
    { id: 'projects', label: 'Projects', icon: Layout },
    { id: 'packages', label: 'Packages', icon: Package },
    { id: 'stars', label: 'Stars', icon: Star },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col font-sans text-[#24292f] dark:text-[#c9d1d9]">
      <Navbar />
      
      {/* ── Sticky Tab Bar ── */}
      <div className="sticky top-[60px] z-40 bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800 mt-6">
        <div className="max-w-[1280px] w-full mx-auto px-4 md:px-8 flex items-end">
          <div className="hidden md:block w-[296px] shrink-0 mr-6" /> {/* Spacer for sidebar */}
          <nav className="flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2 whitespace-nowrap
                    ${active 
                      ? 'border-[#fd8c73] font-semibold text-slate-900 dark:text-slate-100' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-t-lg hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <tab.icon className={`w-4 h-4 ${active ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* ── Left Sidebar ── */}
        <div className="w-full md:w-[296px] shrink-0 -mt-10 md:mt-0 relative z-10">
          <div className="relative w-full max-w-[296px] aspect-square rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 mb-4 shadow-sm z-10">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white text-7xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Mock "Set Status" badge */}
            {isOwner && (
              <button className="absolute bottom-6 right-6 w-10 h-10 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm hover:text-blue-500 transition-colors z-20" aria-label="Set status">
                <Smile className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {profile.full_name || profile.username}
          </h1>
          <h2 className="text-xl font-light text-slate-500 dark:text-slate-400 mb-4">
            {profile.username}
          </h2>

          {isOwner ? (
            <Link href="/settings" className="block w-full py-1.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] border border-slate-300 dark:border-slate-600 rounded-md mb-4 transition-colors">
              Edit profile
            </Link>
          ) : (
            <button className="block w-full py-1.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] border border-slate-300 dark:border-slate-600 rounded-md mb-4 transition-colors">
              Follow
            </button>
          )}

          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 mb-4 hover:text-blue-600 cursor-pointer">
            <Users className="w-4 h-4" />
            <span className="font-semibold text-slate-900 dark:text-slate-200">12</span> followers
            <span className="mx-1">·</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">4</span> following
          </div>

          {profile.bio && (
            <p className="text-[15px] text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
            {profile.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {profile.location}
              </div>
            )}
            {profile.website_url && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-blue-600 hover:underline">
                  {profile.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {profile.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 min-w-0">
          
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Pinned Repos */}
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">Pinned</span>
                  {isOwner && <a href="#" className="text-slate-500 hover:text-blue-500">Customize your pins</a>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pinnedRepos.length > 0 ? pinnedRepos.map(repo => (
                    <div key={repo.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0d1117] flex flex-col shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={`/${profile.username}/${repo.name}`} className="font-semibold text-[15px] text-[#0969da] dark:text-[#58a6ff] hover:underline flex items-center gap-2">
                          <BookMarked className="w-4 h-4 text-slate-500" />
                          {repo.name}
                        </Link>
                        <span className="text-xs font-medium text-slate-500 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5">
                          {repo.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 flex-1 line-clamp-2">
                        {repo.description || 'No description provided.'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {repo.primary_language && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            {repo.primary_language}
                          </div>
                        )}
                        {repo.star_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5" />
                            {repo.star_count}
                          </div>
                        )}
                        {repo.fork_count > 0 && (
                          <div className="flex items-center gap-1">
                            <GitMerge className="w-3.5 h-3.5" />
                            {repo.fork_count}
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-8 text-center text-slate-500 border border-slate-200 dark:border-slate-700 border-dashed rounded-lg text-sm">
                      No pinned repositories found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'repositories' && (
            <div className="animate-fade-in">
              <div className="flex flex-col md:flex-row gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Find a repository..."
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#0d1117] focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm">
                    Type <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm">
                    Language <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm">
                    Sort <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {isOwner && (
                  <Link href="/new" className="flex items-center gap-1 px-4 py-1.5 text-sm font-semibold bg-[#2da44e] text-white border border-[#2da44e] rounded-md shadow-sm hover:bg-[#2c974b] transition-colors">
                    <BookMarked className="w-4 h-4" /> New
                  </Link>
                )}
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredRepos.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    {profile.username} doesn't have any repositories that match.
                  </div>
                ) : (
                  filteredRepos.map(repo => (
                    <div key={repo.id} className="py-6 flex justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/${profile.username}/${repo.name}`} className="text-xl font-semibold text-[#0969da] dark:text-[#58a6ff] hover:underline">
                            {repo.name}
                          </Link>
                          <span className="text-xs font-medium text-slate-500 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5">
                            {repo.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                          </span>
                        </div>
                        {repo.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-2xl">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                          {repo.primary_language && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full bg-blue-500" />
                              {repo.primary_language}
                            </div>
                          )}
                          {repo.star_count > 0 && (
                            <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                              <Star className="w-4 h-4" />
                              {repo.star_count}
                            </div>
                          )}
                          {repo.fork_count > 0 && (
                            <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                              <GitMerge className="w-4 h-4" />
                              {repo.fork_count}
                            </div>
                          )}
                          <span>Updated on {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button className="flex items-center gap-1 px-3 py-1 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm text-slate-700 dark:text-slate-300">
                          <Star className="w-4 h-4 text-slate-400" /> Star
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(activeTab === 'projects' || activeTab === 'packages' || activeTab === 'stars') && (
            <div className="py-20 text-center animate-fade-in border border-slate-200 dark:border-slate-700 rounded-lg">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                No {activeTab} found
              </h2>
              <p className="text-slate-500">
                {profile.username} doesn't have any {activeTab} yet.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
