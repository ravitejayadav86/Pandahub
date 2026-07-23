import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Issue } from '@/types';

export function useIssues(owner: string, repoName: string, state: 'open' | 'closed' = 'open') {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async (filterState = state) => {
    if (!owner || !repoName) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Issue[]>(`/repos/${owner}/${repoName}/issues?state=${filterState}`);
      setIssues(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, state]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  return { issues, loading, error, refetch: fetchIssues };
}

export async function createIssue(owner: string, repoName: string, payload: { title: string; body?: string; priority?: string }) {
  const { data } = await api.post<Issue>(`/repos/${owner}/${repoName}/issues`, payload);
  return data;
}

export async function closeIssue(owner: string, repoName: string, issueNumber: number) {
  const { data } = await api.patch<Issue>(`/repos/${owner}/${repoName}/issues/${issueNumber}`, { state: 'closed' });
  return data;
}
