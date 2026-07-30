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

// ── Mock Data ─────────────────────────────────────────────────────────────
const MOCK_FOLLOWING = [
  { id: '1', username: 'danabramov', full_name: 'Dan Abramov', avatar_url: 'https://i.pravatar.cc/150?u=danabramov', bio: 'Building React.', location: 'London, UK' },
  { id: '2', username: 'leerob', full_name: 'Lee Robinson', avatar_url: 'https://i.pravatar.cc/150?u=leerob', bio: 'VP of Product @ Vercel.', location: 'Des Moines, IA' },
  { id: '3', username: 'guillermorauch', full_name: 'Guillermo Rauch', avatar_url: 'https://i.pravatar.cc/150?u=guillermorauch', bio: 'CEO @ Vercel', location: 'San Francisco, CA' },
  { id: '4', username: 'yyx990803', full_name: 'Evan You', avatar_url: 'https://i.pravatar.cc/150?u=yyx990803', bio: 'Creator of Vue.', location: 'New Jersey, US' },
]

export default function FollowingPage() {
  const params = useParams()
  const org = params.org as string
  const { user: currentUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  useEffect(() => {
    if (!org) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: profileData } = await api.get<UserProfile>(`/auth/users/${org}`)
        setProfile(profileData)
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [org])

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
  
  // ── Tabs rendering ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Overview', icon: Book, href: `/${profile.username}` },
    { id: 'repositories', label: 'Repositories', icon: BookMarked, href: `/${profile.username}?tab=repositories`, count: profile.repo_count },
    { id: 'projects', label: 'Projects', icon: Layout, href: `/${profile.username}?tab=projects` },
    { id: 'packages', label: 'Packages', icon: Package, href: `/${profile.username}?tab=packages` },
    { id: 'stars', label: 'Stars', icon: Star, href: `/${profile.username}?tab=stars` },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col font-sans text-[#24292f] dark:text-[#c9d1d9]">
      <Navbar />
      
      {/* ── Sticky Tab Bar ── */}
      <div className="sticky top-[60px] z-40 bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800 mt-6">
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
                    border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-t-lg hover:border-slate-300 dark:hover:border-slate-600
                  `}
                >
                  <tab.icon className={`w-4 h-4 text-slate-400 dark:text-slate-500`} />
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full">
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
          <div className="relative w-full max-w-[296px] aspect-square rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 mb-4 shadow-sm z-10">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white text-7xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            
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

          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 mb-4">
            <Users className="w-4 h-4" />
            <Link href={`/${profile.username}/followers`} className="hover:text-blue-600 flex items-center gap-1">
              <span className="font-semibold text-slate-900 dark:text-slate-200">12</span> followers
            </Link>
            <span className="mx-1">·</span>
            <Link href={`/${profile.username}/following`} className="text-slate-900 dark:text-slate-200 hover:text-blue-600 flex items-center gap-1 font-semibold">
              <span className="font-semibold text-slate-900 dark:text-slate-200">4</span> following
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

        {/* ── Main Content Area ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
             <div className="flex gap-4">
                 <Link href={`/${profile.username}/followers`} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 pb-2 px-2">
                     Followers <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full ml-1">12</span>
                 </Link>
                 <Link href={`/${profile.username}/following`} className="font-semibold text-slate-900 dark:text-slate-200 border-b-2 border-[#fd8c73] pb-2 px-2">
                     Following <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full ml-1">4</span>
                 </Link>
             </div>
          </div>
          
          <div className="space-y-4">
            {MOCK_FOLLOWING.map(user => (
               <div key={user.id} className="flex items-start gap-4 py-4 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
                  <Link href={`/${user.username}`}>
                    <img src={user.avatar_url} alt={user.username} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                  </Link>
                  <div className="flex-1">
                     <div className="flex items-center gap-1 mb-1">
                        <Link href={`/${user.username}`} className="font-semibold text-slate-900 dark:text-slate-200 hover:text-blue-600 hover:underline">
                           {user.full_name || user.username}
                        </Link>
                        <Link href={`/${user.username}`} className="text-slate-500 hover:text-blue-600">
                           {user.username}
                        </Link>
                     </div>
                     {user.bio && (
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{user.bio}</p>
                     )}
                     {user.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                           <MapPin className="w-3 h-3" />
                           {user.location}
                        </div>
                     )}
                  </div>
                  <div className="flex-shrink-0">
                     <button className="px-4 py-1 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d] shadow-sm text-slate-700 dark:text-slate-300 transition-colors">
                        Unfollow
                     </button>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
