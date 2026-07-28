'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { MapPin, Link as LinkIcon, Calendar, BookMarked, GitMerge, Star, Users } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Navbar from '@/components/shared/Navbar'

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
}

export default function UserProfilePage() {
  const params = useParams()
  const org = params.org as string
  const { user: currentUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!org) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch public profile
        const { data: profileData } = await api.get<UserProfile>(`/auth/users/${org}`)
        setProfile(profileData)

        // Fetch their repos (using explore/repos with a search query as a fallback, 
        // ideally we'd have a dedicated endpoint, but this works if we search by name)
        // If the user is the current user, we can fetch their repos directly:
        if (currentUser && currentUser.username === org) {
          const { data: reposData } = await api.get<Repository[]>('/auth/me/repos')
          setRepos(reposData)
        } else {
          // If it's a public user, we just fetch from explore (or we might need a backend change later)
          const { data: reposData } = await api.get<Repository[]>('/explore/repos', { params: { q: org } })
          // filter to only repos owned by this user (since q might match others)
          // Since the API doesn't return owner_username by default unless requested, we might just show an empty list or the ones we can find.
          // Wait, explore/repos returns owner_username. Let's filter!
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
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">404</h1>
          <p className="text-slate-500 mb-6">User not found.</p>
          <Link href="/dashboard" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left sidebar: Profile Info */}
          <div className="w-full md:w-[296px] shrink-0">
            <div className="relative w-full max-w-[296px] aspect-square rounded-full border border-slate-200 overflow-hidden bg-white mb-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center text-white text-7xl font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {profile.full_name || profile.username}
            </h1>
            <h2 className="text-xl font-light text-slate-500 mb-4">
              {profile.username}
            </h2>

            {currentUser && currentUser.username === profile.username && (
              <Link href="/settings" className="block w-full py-1.5 text-center text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md mb-4 transition-colors">
                Edit profile
              </Link>
            )}

            <div className="flex items-center gap-1 text-sm text-slate-600 mb-4 hover:text-blue-600 cursor-pointer">
              <Users className="w-4 h-4" />
              <span className="font-semibold text-slate-900">0</span> followers
              <span className="mx-1">·</span>
              <span className="font-semibold text-slate-900">0</span> following
            </div>

            {profile.bio && (
              <p className="text-sm text-slate-700 mb-4">{profile.bio}</p>
            )}

            <div className="flex flex-col gap-2 text-sm text-slate-600">
              {profile.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </div>
              )}
              {profile.website_url && (
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                    {profile.website_url}
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

          {/* Right column: Repositories */}
          <div className="flex-1">
            <div className="border-b border-slate-200 mb-6 flex gap-6">
              <div className="pb-3 border-b-2 border-orange-500 text-slate-900 font-semibold flex items-center gap-2">
                <BookMarked className="w-4 h-4" />
                Repositories
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                  {repos.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 border border-slate-200 border-dashed rounded-lg">
                  {profile.username} doesn't have any public repositories that match.
                </div>
              ) : (
                repos.map((repo) => (
                  <div key={repo.id} className="p-4 border border-slate-200 rounded-lg bg-white flex flex-col hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <Link href={`/${profile.username}/${repo.name}`} className="text-blue-600 font-semibold text-lg hover:underline break-all">
                        {repo.name}
                      </Link>
                      <span className="text-xs font-medium text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                        Public
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 flex-1 line-clamp-2">
                      {repo.description || ''}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {repo.primary_language && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          {repo.primary_language}
                        </div>
                      )}
                      {repo.star_count > 0 && (
                        <Link href={`/${profile.username}/${repo.name}/stargazers`} className="flex items-center gap-1 hover:text-blue-600">
                          <Star className="w-3.5 h-3.5" />
                          {repo.star_count}
                        </Link>
                      )}
                      {repo.fork_count > 0 && (
                        <Link href={`/${profile.username}/${repo.name}/network/members`} className="flex items-center gap-1 hover:text-blue-600">
                          <GitMerge className="w-3.5 h-3.5" />
                          {repo.fork_count}
                        </Link>
                      )}
                      <span className="ml-auto">
                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
