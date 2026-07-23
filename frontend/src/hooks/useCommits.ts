import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Commit } from '@/types';

export function useCommits(owner: string, repoName: string, ref: string, page = 1, perPage = 30) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchCommits = useCallback(async (currentPage = page) => {
    if (!owner || !repoName || !ref) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Commit[]>(
        `/repos/${owner}/${repoName}/git/commits/${ref}?page=${currentPage}&per_page=${perPage}`
      );
      setCommits(data);
      setHasMore(data.length === perPage);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load commits');
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, ref, page, perPage]);

  useEffect(() => { fetchCommits(); }, [fetchCommits]);
  return { commits, loading, error, hasMore, refetch: fetchCommits };
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
