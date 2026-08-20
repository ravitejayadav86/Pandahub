"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRepo, useBranches } from "@/hooks/useRepo";

export default function RepoTreeRedirectPage() {
  const params = useParams<{ org: string; repo: string }>();
  const router = useRouter();

  const owner = params?.org ?? "";
  const repoName = params?.repo ?? "";

  const { repo, loading: repoLoading, error: repoError } = useRepo(
    owner,
    repoName,
  );

  const {
    branches,
    loading: branchesLoading,
  } = useBranches(owner, repoName);

  const loading = repoLoading || branchesLoading;

  useEffect(() => {
    if (loading) return;

    // Empty repository: there is no valid ref to redirect to.
    if (!branches.length) return;

    const defaultBranch =
      repo?.default_branch &&
      branches.some((branch) => branch.name === repo.default_branch)
        ? repo.default_branch
        : branches[0]?.name;

    if (!defaultBranch) return;

    router.replace(
      `/${encodeURIComponent(owner)}/${encodeURIComponent(
        repoName,
      )}/tree/${encodeURIComponent(defaultBranch)}`,
    );
  }, [
    loading,
    branches,
    repo?.default_branch,
    owner,
    repoName,
    router,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          <p className="text-sm font-semibold text-slate-700">
            Loading repository…
          </p>
        </div>
      </main>
    );
  }

  if (repoError) {
    return (
      <main className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white px-8 py-7 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <span className="material-symbols-outlined text-red-500">
              error
            </span>
          </div>

          <h1 className="text-lg font-bold text-slate-900">
            Repository could not be loaded
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {repoError}
          </p>

          <button
            type="button"
            onClick={() => router.push(`/${owner}/${repoName}`)}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to repository
          </button>
        </div>
      </main>
    );
  }

  if (!branches.length) {
    return (
      <main className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white px-8 py-9 shadow-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <span className="material-symbols-outlined text-3xl text-slate-500">
              folder_open
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            This repository is empty
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            There are no commits or branches yet, so PandaHub cannot open a
            source tree. Push your first commit and the Code view will appear
            automatically.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/${owner}/${repoName}`)}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to repository
            </button>

            <button
              type="button"
              onClick={() => router.push(`/${owner}/${repoName}/upload`)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Upload files
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
