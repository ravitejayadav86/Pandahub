'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRepo } from '@/hooks/useRepo';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';

export default function TreeRootRedirect() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params.org;
  const repoName = params.repo;
  const router = useRouter();
  const { repo, loading, error } = useRepo(owner, repoName);

  useEffect(() => {
    if (repo?.default_branch) {
      router.replace(`/${owner}/${repoName}/tree/${repo.default_branch}`);
    }
  }, [repo, owner, repoName, router]);

  if (error) {
    return (
      <div style={{ padding: 48 }}>
        <EmptyState
          icon="error"
          title="Could not load repository"
          description={error}
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href={`/${owner}`} style={{ color: 'var(--color-primary)' }}>
            &larr; Back to {owner}
          </Link>
        </div>
      </div>
    );
  }

  return <LoadingSpinner label="Loading repository..." />;
}