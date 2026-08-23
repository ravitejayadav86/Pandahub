import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  Repository,
  Branch,
  Commit,
  TreeEntry,
  BlobContent,
} from "@/types";

function getApiError(error: any, fallback: string): string {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    fallback
  );
}

export function useRepo(owner: string, repoName: string) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(Boolean(owner && repoName));
  const [error, setError] = useState<string | null>(null);

  const fetchRepo = useCallback(async () => {
    if (!owner || !repoName) {
      setRepo(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get<Repository>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`
      );
      setRepo(data);
    } catch (error) {
      setRepo(null);
      setError(getApiError(error, "Failed to load repository"));
    } finally {
      setLoading(false);
    }
  }, [owner, repoName]);

  useEffect(() => {
    void fetchRepo();
  }, [fetchRepo]);

  return {
    repo,
    loading,
    error,
    refetch: fetchRepo,
  };
}

export function useBranches(owner: string, repoName: string) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(Boolean(owner && repoName));
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!owner || !repoName) {
      setBranches([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get<{
        items?: Branch[];
        total?: number;
      }>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/branches`
      );

      setBranches(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setBranches([]);
      setError(getApiError(error, "Failed to load branches"));
    } finally {
      setLoading(false);
    }
  }, [owner, repoName]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  return {
    branches,
    loading,
    error,
    refetch: fetchBranches,
  };
}

export function useTree(
  owner: string,
  repoName: string,
  ref: string,
  path = ""
) {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    if (!owner || !repoName || !ref) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify that the requested ref actually exists before calling
      // /git/tree/{ref}. This is critical for empty repositories.
      const { data: branchData } = await api.get<{
        items?: Branch[];
      }>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/branches`
      );

      const branches = Array.isArray(branchData.items)
        ? branchData.items
        : [];

      const requestedRefExists = branches.some(
        (branch) => branch.name === ref
      );

      if (!requestedRefExists) {
        setEntries([]);
        setError(null);
        return;
      }

      const encodedRef = encodeURIComponent(ref);
      const encodedPath = path
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");

      const url = encodedPath
        ? `/${encodeURIComponent(owner)}/${encodeURIComponent(
            repoName
          )}/git/tree/${encodedRef}/${encodedPath}`
        : `/${encodeURIComponent(owner)}/${encodeURIComponent(
            repoName
          )}/git/tree/${encodedRef}`;

      const { data } = await api.get<{
        ref: string;
        path: string;
        entries?: TreeEntry[];
      }>(url);

      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (error) {
      setEntries([]);
      setError(getApiError(error, "Failed to load repository tree"));
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, ref, path]);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  return {
    entries,
    loading,
    error,
    refetch: fetchTree,
  };
}

export function useBlob(
  owner: string,
  repoName: string,
  ref: string,
  path: string
) {
  const [blob, setBlob] = useState<BlobContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlob = useCallback(async () => {
    if (!owner || !repoName || !ref || !path) {
      setBlob(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const encodedRef = encodeURIComponent(ref);
      const encodedPath = path
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");

      const { data } = await api.get<BlobContent>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(
          repoName
        )}/git/blob/${encodedRef}/${encodedPath}`
      );

      setBlob(data);
    } catch (error) {
      setBlob(null);
      setError(getApiError(error, "Failed to load file"));
    } finally {
      setLoading(false);
    }
  }, [owner, repoName, ref, path]);

  useEffect(() => {
    void fetchBlob();
  }, [fetchBlob]);

  return {
    blob,
    loading,
    error,
    refetch: fetchBlob,
  };
}
