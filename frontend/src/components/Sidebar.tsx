import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, GitMerge, CircleDot, Rocket, Bookmark, Clock, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

export default function Sidebar() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Assume first repo is used for quick links; this component will be used within DashboardPage where repos are available via context.
  // For simplicity, we will accept props later; here we just render static structure.
  return (
    <div className="hidden md:flex w-full md:w-64 flex-col gap-2 shrink-0 animate-fade-in-up">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-3">Menu</div>
      <Button variant="ghost" className="justify-start text-slate-700 font-medium bg-slate-100 dark:bg-slate-800 dark:text-slate-200" onClick={() => router.push('/dashboard')}>
        <LayoutDashboard className="w-4 h-4 mr-2" /> Home
      </Button>
      {/* Repository-specific links will be injected by DashboardPage */}
    </div>
  );
}
