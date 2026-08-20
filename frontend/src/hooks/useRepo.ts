import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  Repository,
  Branch,
  Commit,
  TreeEntry,
  BlobContent,
} from "@/types";

interface BranchResponse {
  items?: Branch[];
  total?: number;
}

interface TreeResponse {
  ref: string;
  path: string;
  entries?: TreeEntry[];
}

function getApiError(error: any, fallback: string): string {
  return (
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
      const { data } = await api.get<BranchResponse>(
        `/${encodeURIComponent(owner)}/${encodeURIComponent(
          repoName
        )}/branches`
      );

      const items = Array.isArray(data?.items) ? data.items : [];

      setBranches(items);
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

/**
 * Load a repository tree.
 *
 * IMPORTANT:
 * `ref` is nullable so empty repositories do not accidentally fall back
 * to "main". An empty repository has no branch and therefore no tree.
 */
export function useTree(
  owner: string,
  repoName: string,
  ref: string | null | undefined,
  path = ""
) {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(owner && repoName && ref));
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

    const encodedRef = encodeURIComponent(ref);

    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const url = encodedPath
      ? `/${encodeURIComponent(owner)}/${encodeURIComponent(
          repoName
        )}/git/tree/${encodedRef}/${encodedPath}`
      : `/${encodeURIComponent(owner)}/${encodeURIComponent(
          repoName
        )}/git/tree/${encodedRef}`;

    try {
      const { data } = await api.get<TreeResponse>(url);

      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (error: any) {
      // A missing ref/path is expected for an empty repository.
      if (error?.response?.status === 404) {
        setEntries([]);
        setError(null);
      } else {
        setEntries([]);
        setError(getApiError(error, "Failed to load repository tree"));
      }
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
  ref: string | null | undefined,
  path: string
) {
  const [blob, setBlob] = useState<BlobContent | null>(null);
  const [loading, setLoading] = useState(Boolean(owner && repoName && ref && path));
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

    const encodedRef = encodeURIComponent(ref);

    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    try {
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
