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
  const router = useRouter();

  const { repo } = useRepo(owner, repoName);
  const { branches } = useBranches(owner, repoName);

  // The FIRST url segment after /tree/ is the branch/ref, everything
  // after that is the file/folder path. handleNavigate below builds URLs
  // in exactly this shape (/tree/{ref}/{path}), so parsing must match it.
  const refFromUrl = pathSegments[0];
  const restSegments = pathSegments.slice(1);
  const currentPath = restSegments.join('/');
  const ref = refFromUrl || (branches.length > 0 ? (repo?.default_branch || branches[0]?.name || '') : '');

  // Check if current path is a blob or tree
  const [viewType, setViewType] = useState<'tree' | 'blob'>('tree');
  const { entries, loading: treeLoading, error: treeError } = useTree(owner, repoName, ref, viewType === 'tree' ? currentPath : undefined);
  const { blob, loading: blobLoading, error: blobError } = useBlob(owner, repoName, ref, viewType === 'blob' ? currentPath : '');

  // If the tree endpoint reports this path is actually a file, switch to blob view.
  useEffect(() => {
    if (treeError && treeError.toLowerCase().includes('is a file')) {
      setViewType('blob');
    }
  }, [treeError]);

  // Detect empty repository (no commits yet) vs a real error
  const isEmptyRepo = !treeLoading && !!treeError && (treeError.toLowerCase().includes('not found') || treeError.toLowerCase().includes('404') || treeError.toLowerCase().includes('ref'));

  const handleNavigate = (path: string, type: 'blob' | 'tree') => {
    setViewType(type);
    router.push(`/${owner}/${repoName}/tree/${ref}/${path}`);
  };

  const handleBranchChange = (newBranch: string) => {
    router.push(`/${owner}/${repoName}/tree/${newBranch}${currentPath ? `/${currentPath}` : ''}`);
  };

  const breadcrumbs = [
    { label: repoName, path: `/${owner}/${repoName}` },
    ...restSegments.map((seg, i) => ({
      label: seg,
      path: `/${owner}/${repoName}/tree/${ref}/${restSegments.slice(0, i + 1).join('/')}`,
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
            <select value={ref} onChange={e => handleBranchChange(e.target.value)}
              style={{ padding: '7px 32px 7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600, background: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif', appearance: 'none' }}>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              {branches.length === 0 && <option value={ref}>{ref}</option>}
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
          : isEmptyRepo ? (
            <div style={{ textAlign: 'center', padding: '64px 24px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>source</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>This repository is empty</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>Get started by pushing your first commit.</p>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '20px 24px', textAlign: 'left', maxWidth: 520, margin: '0 auto', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8, border: '1px solid var(--border-color)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}># …create a new repository on the command line</p>
                <p style={{ margin: 0 }}>git init</p>
                <p style={{ margin: 0 }}>git add .</p>
                <p style={{ margin: 0 }}>git commit -m "first commit"</p>
                <p style={{ margin: 0 }}>git remote add origin &lt;your-remote-url&gt;</p>
                <p style={{ margin: 0 }}>git push -u origin main</p>
              </div>
            </div>
          )
          : viewType === 'tree' && treeError ? <EmptyState icon="error" title="Could not load tree" description={treeError} />
          : blobError ? <EmptyState icon="error" title="Could not load file" description={blobError} />
          : viewType === 'blob' && blob ? <CodeViewer blob={blob} />
          : viewType === 'tree' ? (
            <FileTree entries={entries} owner={owner} repoName={repoName} branch={ref} currentPath={currentPath} onNavigate={handleNavigate} />
          ) : null}
      </div>
    </div>
  );
}