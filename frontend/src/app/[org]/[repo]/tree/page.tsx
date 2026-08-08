'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRepo } from '@/hooks/useRepo';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function TreeRootRedirect() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params.org;
  const repoName = params.repo;
  const router = useRouter();
  const { repo } = useRepo(owner, repoName);

  useEffect(() => {
    if (repo?.default_branch) {
      router.replace(`/${owner}/${repoName}/tree/${repo.default_branch}`);
    }
  }, [repo, owner, repoName, router]);

  return <LoadingSpinner label="Loading repository..." />;
}