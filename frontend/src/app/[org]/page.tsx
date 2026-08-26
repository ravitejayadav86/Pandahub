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
        const { data: profileData } = await api.get<UserProfile>(`/users/${org}`)
        setProfile(profileData)

        // Check follow status if logged in and not owner
        if (currentUser && currentUser.username !== org) {
          try {
            const { data: followers } = await api.get<any[]>(`/users/${org}/followers`)
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
      } catch {
        // Check if this is an organization
        try {
          const { data: orgData } = await api.get<any>(`/orgs/${org}`)
          const { data: orgRepos } = await api.get<Repository[]>(`/orgs/${org}/repos`).catch(() => ({ data: [] }))
          setProfile({
            id: String(orgData.id),
            username: orgData.name,
            full_name: orgData.display_name || orgData.name,
            bio: orgData.description || null,
            avatar_url: orgData.avatar_url || null,
            location: null,
            website_url: orgData.website_url || null,
            is_verified: true,
            created_at: orgData.created_at || null,
            repo_count: Array.isArray(orgRepos) ? orgRepos.length : 0,
            follower_count: 0,
            following_count: 0,
          })
          setRepos(Array.isArray(orgRepos) ? orgRepos : [])
        } catch {
          setError(true)
        }
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
        await api.delete(`/users/${org}/follow`)
        setIsFollowing(false)
        setProfile(prev => prev ? { ...prev, follower_count: Math.max(0, prev.follower_count - 1) } : prev)
      } else {
        await api.post(`/users/${org}/follow`)
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
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-4xl mb-4 select-none">
            🐼
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">User or Organization Not Found</h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-md mb-6">
            The profile for <strong className="text-[var(--text-primary)]">@{org}</strong> does not exist or has been removed.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
              Dashboard
            </Link>
            <Link href="/explore" className="px-5 py-2.5 bg-[var(--glass-bg-2)] hover:bg-[var(--glass-bg-3)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-sm font-medium transition-all">
              Explore Users
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isOwner = !!currentUser && !!profile && currentUser.username?.toLowerCase() === profile.username?.toLowerCase()
  
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
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col font-sans text-[var(--text-primary)]">
      <Navbar />
      
      {/* ── Sticky Tab Bar ── */}
      <div className="sticky top-[60px] z-40 bg-[var(--glass-bg-4)] backdrop-blur-xl border-b border-[var(--glass-border)] mt-4">
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
                    flex items-center gap-2 px-4 py-3 text-sm transition-all border-b-2 whitespace-nowrap
                    ${active 
                      ? 'border-blue-500 font-semibold text-[var(--text-primary)] bg-[var(--glass-bg-2)] rounded-t-lg' 
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--glass-bg-1)] rounded-t-lg hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <tab.icon className={`w-4 h-4 ${active ? 'text-blue-500' : 'text-slate-400'}`} />
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-1 bg-[var(--glass-bg-2)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-xs font-medium px-2 py-0.5 rounded-full">
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
          <div className="relative w-full max-w-[296px] aspect-square rounded-full border border-[var(--glass-border)] overflow-hidden bg-[var(--glass-bg-3)] backdrop-blur-xl mb-4 shadow-xl z-10">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-7xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Mock "Set Status" badge */}
            {isOwner && (
              <button className="absolute bottom-6 right-6 w-10 h-10 glass-panel rounded-full flex items-center justify-center shadow-lg hover:text-blue-500 transition-colors z-20 border border-[var(--glass-border)]" aria-label="Set status">
                <Smile className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {profile.full_name || profile.username}
          </h1>
          <h2 className="text-xl font-light text-[var(--text-secondary)] mb-4">
            {profile.username}
          </h2>

          {isOwner ? (
            <Link href="/settings" className="block w-full py-2 text-center text-sm font-semibold text-[var(--text-primary)] glass-card hover:bg-[var(--glass-bg-4)] rounded-xl mb-4 transition-all border border-[var(--glass-border)]">
              Edit profile
            </Link>
          ) : (
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className="flex-1 py-2 text-center text-sm font-semibold text-[var(--text-primary)] glass-card hover:bg-[var(--glass-bg-4)] rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 border border-[var(--glass-border)]"
              >
                {followLoading && <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={handleOpenChat}
                className="flex-1 py-2 text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Message
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm mb-4">
            <Link href={`/${profile.username}/followers`} className="hover:text-blue-500 transition-colors flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-[var(--text-primary)]">{profile.follower_count}</span>
              <span className="text-[var(--text-secondary)]">followers</span>
            </Link>
            <Link href={`/${profile.username}/following`} className="hover:text-blue-500 transition-colors flex items-center gap-1.5">
              <span className="font-semibold text-[var(--text-primary)]">{profile.following_count}</span>
              <span className="text-[var(--text-secondary)]">following</span>
            </Link>
          </div>

          {profile.bio && (
            <p className="text-[15px] text-[var(--text-secondary)] mb-4 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
            {profile.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                {profile.location}
              </div>
            )}
            {profile.website_url && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-blue-500 hover:underline">
                  {profile.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {profile.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
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
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">Pinned Repositories</span>
                  {isOwner && <a href="#" className="text-slate-400 hover:text-blue-500 text-xs">Customize your pins</a>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pinnedRepos.length > 0 ? pinnedRepos.map(repo => (
                    <div key={repo.id} className="p-5 glass-card rounded-2xl border border-[var(--glass-border)] flex flex-col transition-all hover:scale-[1.02]">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={`/${profile.username}/${repo.name}/tree`} className="font-semibold text-[15px] text-blue-500 hover:underline flex items-center gap-2">
                          <BookMarked className="w-4 h-4 text-slate-400" />
                          {repo.name}
                        </Link>
                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--glass-bg-2)] border border-[var(--glass-border)] rounded-full px-2.5 py-0.5">
                          {repo.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1 line-clamp-2 leading-relaxed">
                        {repo.description || 'No description provided.'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        {repo.primary_language && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            {repo.primary_language}
                          </div>
                        )}
                        {repo.star_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
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
                    <div className="col-span-full py-10 text-center text-slate-400 glass-card border border-[var(--glass-border)] border-dashed rounded-2xl text-sm">
                      No pinned repositories found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'repositories' && (
            <div className="animate-fade-in">
              <div className="flex flex-col md:flex-row gap-4 mb-6 pb-4 border-b border-[var(--glass-border)]">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Find a repository..."
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1 px-3.5 py-2 text-sm font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Type <ChevronDown className="w-4 h-4 opacity-70" />
                  </button>
                  <button className="flex items-center gap-1 px-3.5 py-2 text-sm font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Language <ChevronDown className="w-4 h-4 opacity-70" />
                  </button>
                  <button className="flex items-center gap-1 px-3.5 py-2 text-sm font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    Sort <ChevronDown className="w-4 h-4 opacity-70" />
                  </button>
                </div>
                {isOwner && (
                  <Link href="/new" className="flex items-center gap-1 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all">
                    <BookMarked className="w-4 h-4" /> New
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {filteredRepos.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 glass-card rounded-2xl border border-[var(--glass-border)]">
                    {profile.username} doesn&apos;t have any repositories that match.
                  </div>
                ) : (
                  filteredRepos.map(repo => (
                    <div key={repo.id} className="p-5 glass-card rounded-2xl border border-[var(--glass-border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:scale-[1.005]">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-1">
                          <Link href={`/${profile.username}/${repo.name}/tree`} className="text-lg font-semibold text-blue-500 hover:underline">
                            {repo.name}
                          </Link>
                          <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--glass-bg-2)] border border-[var(--glass-border)] rounded-full px-2.5 py-0.5">
                            {repo.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                          </span>
                        </div>
                        {repo.description && (
                          <p className="text-sm text-[var(--text-secondary)] mb-2 max-w-2xl leading-relaxed">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                          {repo.primary_language && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                              {repo.primary_language}
                            </div>
                          )}
                          {repo.star_count > 0 && (
                            <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                              <Star className="w-3.5 h-3.5 text-amber-400" />
                              {repo.star_count}
                            </div>
                          )}
                          {repo.fork_count > 0 && (
                            <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                              <GitMerge className="w-3.5 h-3.5" />
                              {repo.fork_count}
                            </div>
                          )}
                          <span>Updated on {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--glass-border)]">
                          <Star className="w-3.5 h-3.5 text-amber-400" /> Star
                        </button>

                        {isOwner && (
                          <>
                            <Link
                              href={`/${profile.username}/${repo.name}#settings`}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--glass-border)]"
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
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-red-500/30 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 shadow-sm transition-colors"
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
            <div className="py-20 text-center animate-fade-in glass-card rounded-2xl border border-[var(--glass-border)]">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                No {activeTab} found
              </h2>
              <p className="text-slate-400">
                {profile.username} doesn&apos;t have any {activeTab} yet.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel border border-red-500/30 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-500">Delete repository</h3>
                  <p className="text-xs text-red-400/80">{profile.username}/{repoToDelete.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRepoToDelete(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2.5 text-xs text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>Warning:</strong> This action cannot be undone. All commits, branches, issues, and files will be permanently deleted.
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                To confirm deletion, please type{' '}
                <span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--glass-bg-2)] px-1.5 py-0.5 rounded border border-[var(--glass-border)]">
                  {repoToDelete.name}
                </span>{' '}
                below:
              </p>

              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder={repoToDelete.name}
                className="w-full px-3.5 py-2.5 text-sm font-mono glass-input rounded-xl text-[var(--text-primary)] focus:ring-2 focus:ring-red-500 outline-none"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && deleteConfirmInput.trim() === repoToDelete.name) {
                    handleDeleteRepo()
                  }
                }}
              />

              {deleteModalError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-500">
                  {deleteModalError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRepoToDelete(null)}
                  disabled={isDeletingRepo}
                  className="flex-1 py-2 text-xs font-semibold glass-card rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRepo}
                  disabled={deleteConfirmInput.trim() !== repoToDelete.name || isDeletingRepo}
                  className="flex-1 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
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
