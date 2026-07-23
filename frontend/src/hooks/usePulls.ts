import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  head_branch: string;
  base_branch: string;
  author_id: string;
  author_username?: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  comment_count: number;
  review_count: number;
}

export function usePulls(owner: string, repoName: string, state: 'open' | 'closed' | 'merged' = 'open') {
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPulls = useCallback(async (filterState = state) => {
    if (!owner || !repoName) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PullRequest[]>(`/repos/${owner}/${repoName}/pulls?state=${filterState}`);
      setPulls(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load pull requests');
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, state]);

  useEffect(() => { fetchPulls(); }, [fetchPulls]);
  return { pulls, loading, error, refetch: fetchPulls };
}

export async function createPullRequest(owner: string, repoName: string, payload: {
  title: string; body?: string; head_branch: string; base_branch: string;
}) {
  const { data } = await api.post<PullRequest>(`/repos/${owner}/${repoName}/pulls`, payload);
  return data;
}

export async function mergePullRequest(owner: string, repoName: string, prNumber: number, strategy?: string) {
  const { data } = await api.post(`/repos/${owner}/${repoName}/pulls/${prNumber}/merge`, { strategy: strategy ?? 'merge' });
  return data;
}
