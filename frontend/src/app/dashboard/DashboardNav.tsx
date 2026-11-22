"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Settings } from 'lucide-react';
import SearchBox from '@/components/shared/SearchBox';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';

/** Dashboard-specific toolbar. Primary navigation lives in PandaHubSidebar. */
export function DashboardNav() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  return <header className="ph-dashboard-toolbar">
    <div className="ph-dashboard-toolbar-title"><span aria-hidden="true">✦</span><strong>Workspace</strong><span className="ph-dashboard-toolbar-divider">/</span><span>Overview</span></div>
    <div className="ph-dashboard-toolbar-search"><SearchBox placeholder="Search PandaHub…" maxWidth={360} expandedMaxWidth={440} triggerSlash={true} /></div>
    <div className="ph-dashboard-toolbar-actions">
      <Link className="ph-dashboard-toolbar-create" href="/new" aria-label="Create repository" title="Create repository"><Plus size={18}/><span>New</span></Link>
      <Link className="ph-dashboard-toolbar-icon" href="/settings" aria-label="Settings" title="Settings"><Settings size={19}/></Link>
      {user?.username ? <button className="ph-dashboard-toolbar-avatar" type="button" onClick={() => router.push(`/${encodeURIComponent(user.username)}`)} aria-label="Your profile" title="Your profile"><Avatar size="sm" src={user.avatar_url} fallback={user.username.slice(0, 1).toUpperCase()} /></button>
        : <Link className="ph-dashboard-toolbar-create" href="/login">Sign in</Link>}
    </div>
  </header>;
}
