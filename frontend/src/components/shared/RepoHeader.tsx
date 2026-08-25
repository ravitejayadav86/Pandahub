'use client';
import Link from 'next/link';
import { Repository } from '@/types';

interface RepoHeaderProps {
  owner: string;
  repoName: string;
  repo?: Repository | null;
  activeTab?: string;
}

const TABS = [
  { id: 'code',    label: 'Code',          icon: 'code' },
  { id: 'issues',  label: 'Issues',        icon: 'bug_report' },
  { id: 'pulls',   label: 'Pull Requests', icon: 'alt_route' },
  { id: 'commits', label: 'Commits',       icon: 'commit' },
];

const TAB_HREF: Record<string, string> = {
  code: '',
  issues: '/issues',
  pulls: '/pulls',
  commits: '/commits',
};

export default function RepoHeader({ owner, repoName, repo, activeTab = 'code' }: RepoHeaderProps) {
  const base = `/${owner}/${repoName}`;
  return (
    <div style={{
      background: 'var(--glass-bg-4)',
      backdropFilter: 'blur(20px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
      borderBottom: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>folder</span>
          <Link href={`/${owner}`} style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>{owner}</Link>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>/</span>
          <Link href={base} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{repoName}</Link>
          {repo && (
            <span style={{
              padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: 'var(--glass-bg-2)', border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)', marginLeft: 4
            }}>
              {repo.visibility}
            </span>
          )}
          {repo && (
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>star</span>
                {repo.star_count}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fork_right</span>
                {repo.fork_count}
              </span>
            </div>
          )}
        </div>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <Link
              key={tab.id}
              href={`${base}${TAB_HREF[tab.id]}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500, textDecoration: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                marginBottom: -1,
                borderRadius: '8px 8px 0 0',
                background: activeTab === tab.id ? 'var(--glass-bg-2)' : 'transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
              {tab.id === 'issues' && repo && repo.open_issues_count > 0 && (
                <span style={{
                  padding: '1px 7px', borderRadius: 999,
                  background: 'var(--glass-bg-3)', border: '1px solid var(--glass-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)'
                }}>
                  {repo.open_issues_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
