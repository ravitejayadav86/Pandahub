import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Commit } from '@/types';

export function useCommits(owner: string, repoName: string, ref: string, page = 1, perPage = 30) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchCommits = useCallback(async (currentPage = page) => {
    if (!owner || !repoName) return;
    if (!ref) {
      setCommits([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ items: Commit[]; total: number }>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits/${encodeURIComponent(ref)}?page=${currentPage}&per_page=${perPage}`
      );
      setCommits(Array.isArray(data?.items) ? data.items : []);
      setHasMore((data?.items?.length || 0) === perPage);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Empty repository or uninitialized branch has 0 commits
        setCommits([]);
        setHasMore(false);
        setError(null);
      } else {
        const errorMsg =
          e?.response?.data?.error?.message ||
          e?.response?.data?.detail ||
          e?.response?.data?.message ||
          'Failed to load commits';
        setError(errorMsg);
      }
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
