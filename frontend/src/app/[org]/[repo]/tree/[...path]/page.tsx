'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRepo, useBranches, useTree, useBlob } from '@/hooks/useRepo';
import RepoHeader from '@/components/shared/RepoHeader';
import FileTree from '@/components/repo/FileTree';
import CodeViewer from '@/components/repo/CodeViewer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

export default function TreePage() {
  const params = useParams<{ org: string; repo: string; path: string[] }>();
  const owner = params.org;
  const repoName = params.repo;
  const pathSegments = params.path || [];
  const currentPath = pathSegments.join('/');
  const router = useRouter();

  const { repo } = useRepo(owner, repoName);
  const { branches } = useBranches(owner, repoName);
  const [selectedBranch, setSelectedBranch] = useState('');
  const ref = selectedBranch || repo?.default_branch || 'main';

  // Check if current path is a blob or tree
  const [viewType, setViewType] = useState<'tree' | 'blob'>('tree');
  const { entries, loading: treeLoading, error: treeError } = useTree(owner, repoName, ref, viewType === 'tree' ? currentPath : undefined);
  const { blob, loading: blobLoading, error: blobError } = useBlob(owner, repoName, ref, viewType === 'blob' ? currentPath : '');

  const handleNavigate = (path: string, type: 'blob' | 'tree') => {
    setViewType(type);
    router.push(`/${owner}/${repoName}/tree/${ref}/${path}`);
  };

  const breadcrumbs = [
    { label: repoName, path: `/${owner}/${repoName}` },
    ...pathSegments.map((seg, i) => ({
      label: seg,
      path: `/${owner}/${repoName}/tree/${ref}/${pathSegments.slice(0, i + 1).join('/')}`,
    })),
  ];

  const isLoading = treeLoading || blobLoading;
  const error = treeError || blobError;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      <RepoHeader owner={owner} repoName={repoName} repo={repo} activeTab="code" />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Branch + Path Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select value={selectedBranch || ref} onChange={e => setSelectedBranch(e.target.value)}
              style={{ padding: '7px 32px 7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none' }}>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              {branches.length === 0 && <option>{ref}</option>}
            </select>
            <span className="material-symbols-outlined" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>expand_more</span>
          </div>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, flexWrap: 'wrap' }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
                {i < breadcrumbs.length - 1
                  ? <Link href={crumb.path} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>{crumb.label}</Link>
                  : <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{crumb.label}</span>
                }
              </span>
            ))}
          </div>
        </div>

        {isLoading ? <LoadingSpinner label="Loading..." />
          : error ? <EmptyState icon="error" title="Could not load" description={error} />
          : viewType === 'blob' && blob ? <CodeViewer blob={blob} />
          : viewType === 'tree' ? (
            <FileTree entries={entries} owner={owner} repoName={repoName} ref={ref} currentPath={currentPath} onNavigate={handleNavigate} />
          ) : null}
      </div>
    </div>
  );
}