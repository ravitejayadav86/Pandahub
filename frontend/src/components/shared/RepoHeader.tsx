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
  { id: 'settings',label: 'Settings',      icon: 'settings' },
];

const TAB_HREF: Record<string, string> = {
  code: '',
  issues: '/issues',
  pulls: '/pulls',
  commits: '/commits',
  settings: '/settings',
};

export default function RepoHeader({ owner, repoName, repo, activeTab = 'code' }: RepoHeaderProps) {
  const base = `/${owner}/${repoName}`;
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>folder</span>
          <Link href={`/${owner}`} style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>{owner}</Link>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>/</span>
          <Link href={base} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{repoName}</Link>
          {repo && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginLeft: 4 }}>
              {repo.visibility}
            </span>
          )}
          {repo && (
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>star</span>
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
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => (
            <Link
              key={tab.id}
              href={`${base}${TAB_HREF[tab.id]}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', fontSize: 13, fontWeight: 500, textDecoration: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
              {tab.id === 'issues' && repo && repo.open_issues_count > 0 && (
                <span style={{ padding: '1px 7px', borderRadius: 999, background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
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
