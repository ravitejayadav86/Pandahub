"use client"

import React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/authStore'
import { Search, Plus, Bell, Settings } from 'lucide-react'

export function DashboardNav() {
  const { user } = useAuthStore()

  return (
    <header className="sticky top-0 z-50 h-[64px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
      
      {/* Left section: Logo & Context */}
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl animate-wiggle inline-block">🐼</span>
          <span className="font-bold text-xl tracking-tight hidden md:block text-slate-900 dark:text-white">
            PandaHub
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Dashboard</span>
        </div>
      </div>

      {/* Center/Right section: Search & Actions */}
      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="hidden md:block w-72">
          <Input 
            placeholder="Type / to search..." 
            icon={<Search className="w-4 h-4" />}
            className="h-9"
          />
        </div>
        
        <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4 ml-2">
          <Button variant="ghost" className="w-9 h-9 p-0 rounded-full">
            <Plus className="w-5 h-5 text-slate-500" />
          </Button>
          <Button variant="ghost" className="w-9 h-9 p-0 rounded-full relative">
            <Bell className="w-5 h-5 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
          </Button>
          <Button variant="ghost" className="w-9 h-9 p-0 rounded-full">
            <Settings className="w-5 h-5 text-slate-500" />
          </Button>
          
          <div className="ml-2 cursor-pointer card-lift">
            <Avatar 
              size="md" 
              src={user?.avatar_url} 
              alt={user?.username || 'User'} 
            />
          </div>
        </div>
      </div>
    </header>
  )
}
