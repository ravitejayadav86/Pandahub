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
  follower_count: number
  following_count: number
}

// Removed MOCK_FOLLOWERS

export default function FollowersPage() {
  const params = useParams()
  const org = params.org as string
  const { user: currentUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [followers, setFollowers] = useState<any[]>([])

  useEffect(() => {
    if (!org) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: profileData } = await api.get<UserProfile>(`/users/${org}`)
        setProfile(profileData)
        
        const { data: followersData } = await api.get<any[]>(`/users/${org}/followers`)
        setFollowers(followersData)
      } catch {
        try {
          const { data: orgData } = await api.get<any>(`/orgs/${org}`)
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
            repo_count: 0,
            follower_count: 0,
            following_count: 0,
          })
          setFollowers([])
        } catch {
          setError(true)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [org])

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
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">User Not Found</h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-md mb-6">
            The profile for <strong className="text-[var(--text-primary)]">@{org}</strong> does not exist.
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

  const isOwner = currentUser && currentUser.username === profile.username
  
  // ── Tabs rendering ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Overview', icon: Book, href: `/${profile.username}` },
    { id: 'repositories', label: 'Repositories', icon: BookMarked, href: `/${profile.username}?tab=repositories`, count: profile.repo_count },
    { id: 'projects', label: 'Projects', icon: Layout, href: `/${profile.username}?tab=projects` },
    { id: 'packages', label: 'Packages', icon: Package, href: `/${profile.username}?tab=packages` },
    { id: 'stars', label: 'Stars', icon: Star, href: `/${profile.username}?tab=stars` },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col font-sans text-[var(--text-primary)]">
      <Navbar />
      
      {/* ── Sticky Tab Bar ── */}
      <div className="sticky top-[60px] z-40 bg-[var(--glass-bg-4)] backdrop-blur-xl border-b border-[var(--glass-border)] mt-4">
        <div className="max-w-[1280px] w-full mx-auto px-4 md:px-8 flex items-end">
          <div className="hidden md:block w-[296px] shrink-0 mr-6" />
          <nav className="flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2 whitespace-nowrap
                    border-transparent text-[var(--text-secondary)] hover:bg-[var(--glass-bg-2)] rounded-t-lg hover:text-[var(--text-primary)]
                  `}
                >
                  <tab.icon className={`w-4 h-4 text-slate-400`} />
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-1 bg-[var(--glass-bg-2)] text-[var(--text-secondary)] text-xs font-medium px-2 py-0.5 rounded-full border border-[var(--glass-border)]">
                      {tab.count}
                    </span>
                  )}
                </Link>
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
            <button className="block w-full py-2 text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl mb-4 transition-all shadow-lg shadow-blue-500/20">
              Follow
            </button>
          )}

          <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mb-4">
            <Users className="w-4 h-4" />
            <Link href={`/${profile.username}/followers`} className="text-[var(--text-primary)] hover:text-blue-500 flex items-center gap-1 font-semibold">
              <span className="font-semibold">{profile.follower_count ?? 0}</span> followers
            </Link>
            <span className="mx-1">·</span>
            <Link href={`/${profile.username}/following`} className="hover:text-blue-500 flex items-center gap-1">
              <span className="font-semibold text-[var(--text-primary)]">{profile.following_count ?? 0}</span> following
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
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-[var(--glass-border)]">
             <div className="flex gap-4">
                 <Link href={`/${profile.username}/followers`} className="font-semibold text-blue-500 border-b-2 border-blue-500 pb-2 px-2 flex items-center gap-1.5">
                     Followers <span className="bg-[var(--glass-bg-2)] border border-[var(--glass-border)] text-xs font-medium px-2 py-0.5 rounded-full">{profile.follower_count ?? 0}</span>
                 </Link>
                 <Link href={`/${profile.username}/following`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] pb-2 px-2 flex items-center gap-1.5">
                     Following <span className="bg-[var(--glass-bg-2)] border border-[var(--glass-border)] text-xs font-medium px-2 py-0.5 rounded-full">{profile.following_count ?? 0}</span>
                 </Link>
             </div>
          </div>
          
          <div className="space-y-4">
            {followers.length === 0 ? (
               <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-[var(--glass-border)]">
                 No followers yet.
               </div>
            ) : followers.map(follower => (
               <div key={follower.id} className="glass-card p-5 rounded-2xl border border-[var(--glass-border)] flex items-start gap-4 transition-all hover:scale-[1.01]">
                  <Link href={`/${follower.username}`}>
                    {follower.avatar_url ? (
                      <img src={follower.avatar_url} alt={follower.username} className="w-12 h-12 rounded-full object-cover border border-[var(--glass-border)]" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
                        {follower.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <Link href={`/${follower.username}`} className="font-semibold text-[var(--text-primary)] hover:text-blue-500 hover:underline">
                           {follower.full_name || follower.username}
                        </Link>
                        <Link href={`/${follower.username}`} className="text-sm text-slate-400 hover:text-blue-500">
                           @{follower.username}
                        </Link>
                     </div>
                     {follower.bio && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{follower.bio}</p>
                     )}
                  </div>
               </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
