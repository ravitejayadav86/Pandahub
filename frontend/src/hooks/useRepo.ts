import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Repository, Branch, Commit, TreeEntry, BlobContent } from '@/types';

export function useRepo(owner: string, repoName: string) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepo = useCallback(async () => {
    if (!owner || !repoName) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Repository>(`/repos/${owner}/${repoName}`);
      setRepo(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load repository');
    } finally {
      setLoading(false);
    }
  }, [owner, repoName]);

  useEffect(() => { fetchRepo(); }, [fetchRepo]);
  return { repo, loading, error, refetch: fetchRepo };
}

export function useBranches(owner: string, repoName: string) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!owner || !repoName) return;
    setLoading(true);
    try {
      const { data } = await api.get<Branch[]>(`/repos/${owner}/${repoName}/branches`);
      setBranches(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [owner, repoName]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  return { branches, loading, error, refetch: fetchBranches };
}

export function useTree(owner: string, repoName: string, ref: string, path?: string) {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repoName || !ref) return;
    setLoading(true);
    const url = path
      ? `/repos/${owner}/${repoName}/git/tree/${ref}/${path}`
      : `/repos/${owner}/${repoName}/git/tree/${ref}`;
    api.get<TreeEntry[]>(url)
      .then(({ data }) => setEntries(data))
      .catch((e: any) => setError(e?.response?.data?.detail ?? 'Failed to load tree'))
      .finally(() => setLoading(false));
  }, [owner, repoName, ref, path]);

  return { entries, loading, error };
}

export function useBlob(owner: string, repoName: string, ref: string, path: string) {
  const [blob, setBlob] = useState<BlobContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repoName || !ref || !path) return;
    setLoading(true);
    api.get<BlobContent>(`/repos/${owner}/${repoName}/git/blob/${ref}/${path}`)
      .then(({ data }) => setBlob(data))
      .catch((e: any) => setError(e?.response?.data?.detail ?? 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [owner, repoName, ref, path]);

  return { blob, loading, error };
}
