import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Clock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Link } from 'next/link';

interface ActivityEvent {
  id: string;
  type: 'pr_opened' | 'pr_merged' | 'issue_opened' | 'issue_closed';
  title: string;
  repo: string;
  author: string;
  created_at: string;
}

function activityDescription(type: string): string {
  switch (type) {
    case 'pr_opened':
      return 'opened a pull request in';
    case 'pr_merged':
      return 'merged a pull request in';
    case 'issue_opened':
      return 'opened an issue in';
    case 'issue_closed':
      return 'closed an issue in';
    default:
      return 'acted in';
  }
}

export default function ActivityFeedCard({ activity }: { activity: ActivityEvent }) {
  const { user } = useAuthStore();
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const ActivityIcon = ({ type }: { type: string }) =>
    type.includes('pr') ? (
      <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
    ) : (
      <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12" y2="16" /></svg>
    );

  return (
    <Card variant="glass-card" interactive="lift" className="p-4">
      <CardHeader className="pb-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-500">
            <ActivityIcon type={activity.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{activity.author}</span>{' '}
              {activityDescription(activity.type)}{' '}
              <Link href={`/${activity.repo}`} className="font-medium text-blue-600 hover:underline">
                {activity.repo}
              </Link>
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate mt-0.5">
              {activity.title}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(activity.created_at)}
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
