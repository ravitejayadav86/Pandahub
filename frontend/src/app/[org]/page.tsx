'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { 
  MapPin, Link as LinkIcon, Calendar, BookMarked, GitMerge, Star, Users, 
  Smile, Search, ChevronDown, Activity, Package, Layout, Book, Trophy, Hexagon,
  Settings, Trash2, AlertTriangle, X, Loader2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/shared/Navbar'
import ChatBox from '@/components/shared/ChatBox'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  follower_count: number
  following_count: number
  public_key?: string | null
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

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function UserProfilePage() {
  const params = useParams()
  const org = params.org as string
  const { user: currentUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [repos, setRepos] = useState<Repository[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(false)

  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [repoSearch, setRepoSearch] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Delete repo modal state
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [isDeletingRepo, setIsDeletingRepo] = useState(false)
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null)

  const router = useRouter()
  
  useEffect(() => {
    if (!org) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: profileData } = await api.get<UserProfile>(`/auth/users/${org}`)
        setProfile(profileData)

        // Check follow status if logged in and not owner
        if (currentUser && currentUser.username !== org) {
          try {
            const { data: followers } = await api.get<any[]>(`/auth/users/${org}/followers`)
            setIsFollowing(followers.some(f => f.username === currentUser.username))
          } catch (e) {
            console.error("Failed to load followers", e)
          }
        }

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

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    if (followLoading) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await api.delete(`/auth/users/${org}/follow`)
        setIsFollowing(false)
        setProfile(prev => prev ? { ...prev, follower_count: Math.max(0, prev.follower_count - 1) } : prev)
      } else {
        await api.post(`/auth/users/${org}/follow`)
        setIsFollowing(true)
        setProfile(prev => prev ? { ...prev, follower_count: prev.follower_count + 1 } : prev)
      }
    } catch (e) {
      console.error('Failed to toggle follow', e)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleOpenChat = () => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    setIsChatOpen(true)
  }

  const handleDeleteRepo = async () => {
    if (!repoToDelete || !profile) return
    if (deleteConfirmInput.trim() !== repoToDelete.name) return

    setIsDeletingRepo(true)
    setDeleteModalError(null)

    try {
      await api.delete(`/${encodeURIComponent(profile.username)}/${encodeURIComponent(repoToDelete.name)}`)
      // Remove from repos list
      setRepos(prev => prev.filter(r => r.id !== repoToDelete.id))
      setProfile(prev => prev ? { ...prev, repo_count: Math.max(0, prev.repo_count - 1) } : prev)
      setRepoToDelete(null)
      setDeleteConfirmInput('')
    } catch (err: any) {
      setDeleteModalError(
        err?.response?.data?.detail || 
        err?.response?.data?.message || 
        err?.response?.data?.error?.message ||
        'Failed to delete repository. Please ensure you are logged in as the owner.'
      )
    } finally {
      setIsDeletingRepo(false)
    }
  }

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

  const isOwner = !!currentUser && !!profile && currentUser.username?.toLowerCase() === profile.username?.toLowerCase()
  
  // Repo filtering
  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()))
  const pinnedRepos = repos.sort((a, b) => b.star_count - a.star_count).slice(0, 6)

  // â”€â”€ Tabs rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      
      {/* â”€â”€ Sticky Tab Bar â”€â”€ */}
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
        
        {/* â”€â”€ Left Sidebar â”€â”€ */}
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
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className="flex-1 py-1.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] border border-slate-300 dark:border-slate-600 rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {followLoading && <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={handleOpenChat}
                className="flex-1 py-1.5 text-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors border border-blue-700 shadow-sm"
              >
                Message
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm mb-4">
            <Link href={`/${profile.username}/followers`} className="hover:text-blue-500 transition-colors flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">{profile.follower_count}</span>
              <span className="text-slate-500">followers</span>
            </Link>
            <Link href={`/${profile.username}/following`} className="hover:text-blue-500 transition-colors flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{profile.following_count}</span>
              <span className="text-slate-500">following</span>
            </Link>
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

        {/* â”€â”€ Main Content Area â”€â”€ */}
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
                        <Link href={`/${profile.username}/${repo.name}/tree`} className="font-semibold text-[15px] text-[#0969da] dark:text-[#58a6ff] hover:underline flex items-center gap-2">
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
                          <Link href={`/${profile.username}/${repo.name}/tree`} className="text-xl font-semibold text-[#0969da] dark:text-[#58a6ff] hover:underline">
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
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm text-slate-700 dark:text-slate-300 transition-colors">
                          <Star className="w-3.5 h-3.5 text-slate-400" /> Star
                        </button>

                        {isOwner && (
                          <>
                            <Link
                              href={`/${profile.username}/${repo.name}#settings`}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm text-slate-700 dark:text-slate-300 no-underline transition-colors"
                              title="Repository Settings"
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-400" /> Settings
                            </Link>

                            <button
                              onClick={() => {
                                setRepoToDelete(repo)
                                setDeleteConfirmInput('')
                                setDeleteModalError(null)
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-red-200 dark:border-red-900/50 rounded-md bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 shadow-sm transition-colors"
                              title="Delete Repository"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </>
                        )}
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

      {isChatOpen && currentUser && (
        <ChatBox 
          recipientUsername={profile.username} 
          onClose={() => setIsChatOpen(false)} 
        />
      )}

      {/* ── Delete Repository Confirmation Modal ──────────────────────── */}
      {repoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161b22] border border-red-200 dark:border-red-900/50 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50/70 dark:bg-red-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Delete repository</h3>
                  <p className="text-xs text-red-500/80">{profile.username}/{repoToDelete.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRepoToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-red-100/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Warning:</strong> This action cannot be undone. All commits, branches, issues, and files will be permanently deleted.
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                To confirm deletion, please type{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {repoToDelete.name}
                </span>{' '}
                below:
              </p>

              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder={repoToDelete.name}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && deleteConfirmInput.trim() === repoToDelete.name) {
                    handleDeleteRepo()
                  }
                }}
              />

              {deleteModalError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 text-xs text-red-700 dark:text-red-400">
                  {deleteModalError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRepoToDelete(null)}
                  disabled={isDeletingRepo}
                  className="flex-1 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRepo}
                  disabled={deleteConfirmInput.trim() !== repoToDelete.name || isDeletingRepo}
                  className="flex-1 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {isDeletingRepo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete this repository
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
