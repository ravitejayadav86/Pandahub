
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";
import api from "@/lib/api";

interface UserProfile {
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  repo_count: number;
  follower_count: number;
  following_count: number;
}

interface RepoMeta {
  id: string;
  name: string;
  description?: string;
  visibility: "public" | "private" | "internal";
  star_count: number;
  fork_count: number;
  watcher_count: number;
  default_branch: string;
  is_fork: boolean;
  pushed_at?: string;
}

interface BranchResponse {
  items: Array<{
    name: string;
    is_default?: boolean;
  }>;
  total: number;
}

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      detail?: string;
      message?: string;
    };
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const typed = error as ApiErrorShape;

  return (
    typed?.response?.data?.detail ||
    typed?.response?.data?.message ||
    fallback
  );
}

export default function RepoDashboardPage() {
  const params = useParams<{ org: string; repo: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const { user, clearAuth } = useAuthStore();

  const owner = params?.org ?? "";
  const repoName = params?.repo ?? "";
  const repoBase = `/${owner}/${repoName}`;

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);

  const [repoMeta, setRepoMeta] = useState<RepoMeta | null>(null);
  const [repoLoading, setRepoLoading] = useState(true);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [branches, setBranches] = useState<BranchResponse | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const [starring, setStarring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Settings / Delete repo
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isOwner = !!user && user.username === owner;

  const profileRef = useRef<HTMLDivElement>(null);

  const isEmptyRepository = useMemo(() => {
    if (!branches || branchesLoading) return false;
    return branches.items.length === 0;
  }, [branches, branchesLoading]);

  const cloneUrl = useMemo(() => {
    if (!owner || !repoName) return "";
    return `${window.location.origin}/git/${owner}/${repoName}.git`;
  }, [owner, repoName]);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  useEffect(() => {
    if (!owner || !repoName) return;

    let cancelled = false;

    const loadRepository = async () => {
      setRepoLoading(true);
      setRepoError(null);

      try {
        const { data } = await api.get<RepoMeta>(
          `/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`
        );

        if (!cancelled) {
          setRepoMeta(data);
        }
      } catch (error) {
        if (!cancelled) {
          setRepoMeta(null);
          setRepoError(
            getErrorMessage(error, "Unable to load this repository.")
          );
        }
      } finally {
        if (!cancelled) {
          setRepoLoading(false);
        }
      }
    };

    loadRepository();

    return () => {
      cancelled = true;
    };
  }, [owner, repoName]);

  useEffect(() => {
    if (!owner) return;

    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        const { data } = await api.get<UserProfile>(
          `/auth/users/${encodeURIComponent(owner)}`
        );

        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [owner]);

  useEffect(() => {
    if (!owner || !repoName) return;

    let cancelled = false;

    const loadBranches = async () => {
      setBranchesLoading(true);

      try {
        const { data } = await api.get<BranchResponse>(
          `/${encodeURIComponent(owner)}/${encodeURIComponent(
            repoName
          )}/branches`
        );

        if (!cancelled) {
          setBranches(data);
        }
      } catch {
        if (!cancelled) {
          setBranches({
            items: [],
            total: 0,
          });
        }
      } finally {
        if (!cancelled) {
          setBranchesLoading(false);
        }
      }
    };

    loadBranches();

    return () => {
      cancelled = true;
    };
  }, [owner, repoName]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleLogout = () => {
    logout();
    clearAuth();
    router.push("/");
  };

  const handleCopyCloneUrl = async () => {
    try {
      await navigator.clipboard.writeText(cloneUrl);
      setCopied(true);
      setNotice("Clone URL copied.");

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setNotice("Could not copy the clone URL.");
    }
  };

  const handleStar = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!repoMeta || starring) return;

    setStarring(true);

    try {
      const wasStarred = repoMeta.star_count > 0;

      if (wasStarred) {
        await api.delete(`/${owner}/${repoName}/star`);

        setRepoMeta((current) =>
          current
            ? {
                ...current,
                star_count: Math.max(0, current.star_count - 1),
              }
            : current
        );

        setNotice("Repository unstarred.");
      } else {
        const { data } = await api.post<{ star_count?: number }>(
          `/${owner}/${repoName}/star`
        );

        setRepoMeta((current) =>
          current
            ? {
                ...current,
                star_count:
                  typeof data?.star_count === "number"
                    ? data.star_count
                    : current.star_count + 1,
              }
            : current
        );

        setNotice("Repository starred.");
      }
    } catch (error) {
      setNotice(getErrorMessage(error, "Unable to update star status."));
    } finally {
      setStarring(false);
    }
  };

  const handleFork = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const { data } = await api.post<{ name: string }>(
        `/${owner}/${repoName}/fork`
      );

      if (data?.name) {
        router.push(`/${user.username}/${data.name}`);
        return;
      }

      setNotice("Fork created, but the destination was not returned.");
    } catch (error) {
      setNotice(getErrorMessage(error, "Fork failed."));
    }
  };

  const handleDeleteRepo = async () => {
    if (deleteConfirmText !== repoName) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`);
      router.push('/dashboard');
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Failed to delete repository. Please try again.'));
      setIsDeleting(false);
    }
  };

  const isActive = (href: string) => {
    if (href === repoBase) {
      return pathname === repoBase;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebarItems = [
    {
      label: "Overview",
      icon: "grid_view",
      href: repoBase,
    },
    {
      label: "Code",
      icon: "code",
      href: repoBase,
    },
    {
      label: "Commits",
      icon: "commit",
      href: `${repoBase}/commits`,
    },
    {
      label: "Issues",
      icon: "adjust",
      href: `${repoBase}/issues`,
    },
    {
      label: "Pull Requests",
      icon: "alt_route",
      href: `${repoBase}/pulls`,
    },
    {
      label: "Security",
      icon: "security",
      href: `${repoBase}/security`,
    },
  ];

  const visibilityClass =
    repoMeta?.visibility === "private"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : repoMeta?.visibility === "internal"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

  const profileInitial =
    (profile?.username || owner || user?.username || "U")
      .charAt(0)
      .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 h-screen">
          <div className="h-[72px] border-b border-slate-100 px-6 flex items-center">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 no-underline"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white">
                  public
                </span>
              </div>

              <div>
                <div className="text-base font-extrabold tracking-tight">
                  PandaHub
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Repository platform
                </div>
              </div>
            </Link>
          </div>

          <div className="p-5">
            <Link
              href="/new"
              className="w-full h-10 rounded-xl bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center gap-2 text-sm font-semibold no-underline transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                add
              </span>
              New Repository
            </Link>
          </div>

          <nav className="px-3 flex-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Repository
            </div>

            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const active =
                  item.label === "Code"
                    ? pathname === repoBase
                    : isActive(item.href);

                return (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium no-underline transition-colors ${
                      active
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-7 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Repository tools
            </div>

            <div className="space-y-1">
              {[
                {
                  label: "File Tree",
                  icon: "folder_open",
                  href: `${repoBase}/tree`,
                },
                {
                  label: "Upload Files",
                  icon: "upload_file",
                  href: `${repoBase}/upload`,
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 no-underline transition-colors"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="border-t border-slate-100 p-3 space-y-1">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 no-underline"
            >
              <span className="material-symbols-outlined text-[19px]">
                settings
              </span>
              Settings
            </Link>

            <Link
              href="/explore"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 no-underline"
            >
              <span className="material-symbols-outlined text-[19px]">
                explore
              </span>
              Explore
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="min-h-[72px] px-5 lg:px-8 flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      href={`/${owner}`}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-950 no-underline truncate"
                    >
                      {owner || "owner"}
                    </Link>

                    <span className="text-slate-300">/</span>

                    <Link
                      href={repoBase}
                      className="text-sm sm:text-base font-bold text-slate-950 hover:text-blue-600 no-underline truncate"
                    >
                      {repoName || "repository"}
                    </Link>

                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${visibilityClass}`}
                    >
                      {repoMeta?.visibility || "—"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500 truncate max-w-[52vw]">
                    {repoMeta?.description ||
                      "Repository overview and developer activity"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`${repoBase}/commits`}
                  title="Commit history"
                  className="hidden sm:flex w-9 h-9 rounded-lg border border-slate-200 items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 no-underline"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    history
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShowDeployModal(true)}
                  className="h-9 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2"
                >
                  <span>🚀</span>
                  <span className="hidden sm:inline">Deploy</span>
                </button>

                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen((value) => !value)}
                    className="w-9 h-9 rounded-full border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center"
                    aria-label="Open profile menu"
                  >
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username || "Profile"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-600">
                        {(user?.username || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-2xl p-2">
                      <div className="px-3 py-3 border-b border-slate-100">
                        <div className="text-sm font-bold text-slate-950">
                          {user?.username || "User"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {user?.email || "No email"}
                        </div>
                      </div>

                      <div className="pt-2">
                        {[
                          {
                            href: `/${user?.username || owner}`,
                            icon: "person",
                            label: "Profile",
                          },
                          {
                            href: "/dashboard",
                            icon: "code_blocks",
                            label: "Repositories",
                          },
                          {
                            href: "/settings",
                            icon: "settings",
                            label: "Settings",
                          },
                        ].map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:text-slate-950 hover:bg-slate-50 no-underline"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {item.icon}
                            </span>
                            {item.label}
                          </Link>
                        ))}

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            logout
                          </span>
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div
            className={`mx-auto max-w-[1450px] px-5 lg:px-8 py-6 lg:py-8 transition-opacity duration-500 ${
              mounted ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Error banner */}
            {repoError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-500 mt-0.5">
                  error
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-red-800 text-sm">
                    Unable to load repository
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    {repoError}
                  </div>
                </div>
              </div>
            )}

            {/* Repo summary */}
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5 sm:p-7">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        <span className="material-symbols-outlined text-[15px]">
                          folder
                        </span>
                        Repository
                      </span>

                      {repoMeta?.is_fork && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                          <span className="material-symbols-outlined text-[15px]">
                            fork_right
                          </span>
                          Fork
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                      {repoName || "Repository"}
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm sm:text-base leading-6 text-slate-500">
                      {repoLoading
                        ? "Loading repository details…"
                        : repoMeta?.description ||
                          "No repository description has been added yet."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                        Default branch:{" "}
                        <span className="text-slate-900 font-semibold">
                          {repoMeta?.default_branch || "main"}
                        </span>
                      </span>

                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
                        {branchesLoading
                          ? "Checking branches…"
                          : `${branches?.total ?? 0} branch${
                              (branches?.total ?? 0) === 1 ? "" : "es"
                            }`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCloneUrl}
                      disabled={!cloneUrl}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        content_copy
                      </span>
                      {copied ? "Copied" : "Clone"}
                    </button>

                    <button
                      type="button"
                      onClick={handleStar}
                      disabled={starring || repoLoading}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        star
                      </span>
                      {starring ? "Saving…" : `Star ${repoMeta?.star_count ?? 0}`}
                    </button>

                    <button
                      type="button"
                      onClick={handleFork}
                      disabled={!repoMeta}
                      className="h-10 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        fork_right
                      </span>
                      Fork
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 sm:px-7 h-14 flex items-center gap-5 overflow-x-auto">
                {[
                  { label: "Overview", href: repoBase },
                  { label: "Commits", href: `${repoBase}/commits` },
                  { label: "Issues", href: `${repoBase}/issues` },
                  { label: "Pull Requests", href: `${repoBase}/pulls` },
                  { label: "Security", href: `${repoBase}/security` },
                  ...(isOwner ? [{ label: "Settings", href: `${repoBase}#settings` }] : []),
                ].map((item) => {
                  const isSettings = item.label === 'Settings';
                  const selected = isSettings
                    ? activeTab === 'Settings'
                    : item.label === "Overview"
                      ? pathname === repoBase && activeTab !== 'Settings'
                      : pathname?.startsWith(item.href);

                  return isSettings ? (
                    <button
                      key="Settings"
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'Settings' ? 'Overview' : 'Settings')}
                      className={`h-full flex items-center gap-1.5 border-b-2 text-sm font-semibold whitespace-nowrap ${
                        selected
                          ? 'border-red-500 text-red-600'
                          : 'border-transparent text-slate-500 hover:text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">settings</span>
                      Settings
                    </button>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setActiveTab('Overview')}
                      className={`h-full flex items-center border-b-2 text-sm font-semibold no-underline whitespace-nowrap ${
                        selected
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-950"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Empty repository */}
            {isEmptyRepository && activeTab !== 'Settings' && (
              <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[30px] text-slate-500">
                    inventory_2
                  </span>
                </div>

                <h2 className="mt-5 text-xl sm:text-2xl font-extrabold text-slate-950">
                  This repository is empty
                </h2>

                <p className="mt-2 max-w-xl mx-auto text-sm leading-6 text-slate-500">
                  No commits or branches exist yet. Create your first commit
                  locally and push it to PandaHub to start browsing code.
                </p>

                <div className="mt-6 max-w-2xl mx-auto rounded-2xl bg-slate-950 p-5 text-left overflow-x-auto">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">
                    Panda CLI
                  </div>

                  <pre className="text-xs sm:text-sm text-slate-200 leading-7">
{`panda clone ${owner}/${repoName}
cd ${repoName}
panda add .
panda commit -m "Initial commit"
panda push -u pandahub main`}
                  </pre>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyCloneUrl}
                    className="h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800"
                  >
                    {copied ? "Clone URL copied" : "Copy clone URL"}
                  </button>

                  <Link
                    href={`${repoBase}/upload`}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center no-underline"
                  >
                    Upload files
                  </Link>
                </div>
              </section>
            )}

            {/* ── Repo Settings (owner only) ───────────────────────────────── */}
            {activeTab === 'Settings' && isOwner && (
              <div className="mt-6 space-y-6 max-w-2xl">

                {/* General settings */}
                <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-base font-extrabold text-slate-950">General</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Basic repository settings</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="repo-description">Description</label>
                      <textarea
                        id="repo-description"
                        rows={3}
                        defaultValue={repoMeta?.description ?? ''}
                        placeholder="A short description of your repository…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Visibility</label>
                      <div className="flex gap-3">
                        {(['public', 'private', 'internal'] as const).map(v => (
                          <label key={v} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="visibility" value={v} defaultChecked={repoMeta?.visibility === v} className="accent-blue-600" />
                            <span className="text-sm text-slate-700 capitalize">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold"
                      onClick={() => setNotice('Settings saved (demo — API update coming soon).')}
                    >
                      Save changes
                    </button>
                  </div>
                </section>

                {/* Danger zone */}
                <section className="rounded-3xl border-2 border-red-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-red-100 bg-red-50/50">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-500 text-[20px]">warning</span>
                      <h2 className="text-base font-extrabold text-red-700">Danger Zone</h2>
                    </div>
                    <p className="text-xs text-red-500 mt-0.5">These actions are irreversible — proceed with extreme caution.</p>
                  </div>

                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Delete this repository</div>
                        <div className="text-xs text-slate-500 mt-0.5">Once deleted, all code, issues, and pull requests will be permanently removed.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(null); }}
                        className="shrink-0 h-9 px-4 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete_forever</span>
                        Delete repository
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Main grid */}
            {!isEmptyRepository && activeTab !== 'Settings' && (
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] gap-6">
                {/* Owner card */}
                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.username || owner}
                            className="w-full h-full object-cover"
                          />
                        ) : user?.avatar_url && user.username === owner ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-extrabold text-slate-500">
                            {profileInitial}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-slate-950 truncate">
                          {profile?.full_name || owner || "Owner"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          @{profile?.username || owner}
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      {profileLoading
                        ? "Loading profile…"
                        : profile?.bio || "No bio available."}
                    </p>

                    <Link
                      href={`/${owner}`}
                      className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700 no-underline"
                    >
                      View profile →
                    </Link>

                    <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
                      {[
                        ["Repos", profile?.repo_count],
                        ["Followers", profile?.follower_count],
                        ["Following", profile?.following_count],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="text-center">
                          <div className="text-lg font-extrabold text-slate-950">
                            {profileLoading ? "—" : value ?? 0}
                          </div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
                    <div className="text-sm font-bold text-slate-950 mb-3">
                      Quick access
                    </div>

                    <div className="space-y-1">
                      {[
                        {
                          label: "Commits",
                          href: `${repoBase}/commits`,
                          icon: "commit",
                        },
                        {
                          label: "Issues",
                          href: `${repoBase}/issues`,
                          icon: "adjust",
                        },
                        {
                          label: "Pull Requests",
                          href: `${repoBase}/pulls`,
                          icon: "alt_route",
                        },
                        {
                          label: "Security",
                          href: `${repoBase}/security`,
                          icon: "security",
                        },
                        {
                          label: "Upload files",
                          href: `${repoBase}/upload`,
                          icon: "upload_file",
                        },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 no-underline"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {item.icon}
                          </span>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Center */}
                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-950">
                          {activeTab}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Repository activity and developer overview.
                        </p>
                      </div>

                      <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                        {["Overview", "Activity", "Stats"].map((tabName) => (
                          <button
                            key={tabName}
                            type="button"
                            onClick={() => setActiveTab(tabName)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              activeTab === tabName
                                ? "bg-white text-slate-950 shadow-sm"
                                : "text-slate-500 hover:text-slate-950"
                            }`}
                          >
                            {tabName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6">
                      {activeTab === "Overview" && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Link
                            href={repoBase}
                            className="group rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:bg-slate-50 no-underline"
                          >
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-blue-600">
                                code
                              </span>
                            </div>
                            <h3 className="mt-4 font-bold text-slate-950">
                              Browse code
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              View files and source code in this repository.
                            </p>
                          </Link>

                          <Link
                            href={`${repoBase}/commits`}
                            className="group rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:bg-slate-50 no-underline"
                          >
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-emerald-600">
                                history
                              </span>
                            </div>
                            <h3 className="mt-4 font-bold text-slate-950">
                              Commit history
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Inspect recent commits and development history.
                            </p>
                          </Link>

                          <Link
                            href={`${repoBase}/issues`}
                            className="group rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:bg-slate-50 no-underline"
                          >
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-rose-600">
                                adjust
                              </span>
                            </div>
                            <h3 className="mt-4 font-bold text-slate-950">
                              Issues
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Track bugs, feature requests, and discussions.
                            </p>
                          </Link>

                          <Link
                            href={`${repoBase}/pulls`}
                            className="group rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:bg-slate-50 no-underline"
                          >
                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-violet-600">
                                alt_route
                              </span>
                            </div>
                            <h3 className="mt-4 font-bold text-slate-950">
                              Pull requests
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Review and merge changes from contributors.
                            </p>
                          </Link>
                        </div>
                      )}

                      {activeTab === "Activity" && (
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-500">
                              timeline
                            </span>
                          </div>
                          <h3 className="mt-4 font-bold text-slate-950">
                            Activity is ready for your commits
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                            Push changes, open issues, or create pull requests
                            to populate the repository activity feed.
                          </p>
                        </div>
                      )}

                      {activeTab === "Stats" && (
                        <div className="grid sm:grid-cols-3 gap-4">
                          {[
                            ["Stars", repoMeta?.star_count ?? 0, "star"],
                            ["Forks", repoMeta?.fork_count ?? 0, "fork_right"],
                            ["Watchers", repoMeta?.watcher_count ?? 0, "visibility"],
                          ].map(([label, value, icon]) => (
                            <div
                              key={String(label)}
                              className="rounded-2xl border border-slate-200 p-5"
                            >
                              <span className="material-symbols-outlined text-slate-500">
                                {String(icon)}
                              </span>
                              <div className="mt-4 text-2xl font-extrabold text-slate-950">
                                {value}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-extrabold">
                          Repository status
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Current repository state.
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Available
                      </span>
                    </div>

                    <div className="mt-5 grid sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-500">
                          Default branch
                        </div>
                        <div className="mt-1 font-bold text-slate-950">
                          {repoMeta?.default_branch || "main"}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-500">
                          Last push
                        </div>
                        <div className="mt-1 font-bold text-slate-950">
                          {repoMeta?.pushed_at
                            ? new Date(repoMeta.pushed_at).toLocaleString()
                            : "No pushes yet"}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right */}
                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
                    <div className="text-sm font-extrabold text-slate-950">
                      Repository actions
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        onClick={handleCopyCloneUrl}
                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[19px] text-blue-600">
                          content_copy
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {copied ? "Clone URL copied" : "Copy clone URL"}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            Use with Git or Panda CLI
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStar}
                        disabled={starring}
                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[19px] text-amber-500">
                          star
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {starring ? "Updating…" : "Star repository"}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {repoMeta?.star_count ?? 0} stars
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleFork}
                        className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[19px] text-violet-500">
                          fork_right
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            Fork repository
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {repoMeta?.fork_count ?? 0} forks
                          </span>
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <span className="text-sm">🐼</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold">Panda CLI</div>
                        <div className="text-[11px] text-slate-400">
                          Git-compatible workflow
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 overflow-x-auto">
                      <code className="text-[11px] leading-6 text-slate-200 whitespace-pre">
{`panda clone ${owner}/${repoName}
cd ${repoName}
panda status
panda add .
panda commit -m "update"
panda push`}
                      </code>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {notice && (
        <div className="fixed bottom-5 right-5 z-[100] rounded-xl bg-slate-950 text-white px-4 py-3 shadow-2xl text-sm font-medium">
          {notice}
        </div>
      )}

           {/* Deploy modal */}
      {showDeployModal && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDeployModal(false);
            }
          }}
        >
          <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold text-slate-950">
                  Deploy repository
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Deploy {owner}/{repoName}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeployModal(false)}
                className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-3">
              {[
                {
                  name: "Render",
                  description:
                    "Web services, workers, databases, and background jobs.",
                  href: "https://render.com/deploy",
                },
                {
                  name: "Railway",
                  description:
                    "Fast application deployments with minimal configuration.",
                  href: "https://railway.app/new",
                },
                {
                  name: "Vercel",
                  description:
                    "Optimized deployment platform for Next.js frontends.",
                  href: "https://vercel.com/new",
                },
              ].map((platform) => (
                <a
                  key={platform.name}
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50 no-underline transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-950">
                        {platform.name}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {platform.description}
                      </div>
                    </div>

                    <span className="material-symbols-outlined text-slate-400">
                      open_in_new
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Repository Confirmation Modal ────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-red-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-red-100 bg-red-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-600">delete_forever</span>
              </div>
              <div>
                <div className="text-base font-extrabold text-red-700">Delete repository</div>
                <div className="text-xs text-red-500 mt-0.5">{owner}/{repoName}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="ml-auto w-8 h-8 rounded-lg hover:bg-red-100 flex items-center justify-center text-red-400"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <span className="font-bold">⚠ This action cannot be undone.</span> All commits, branches, issues, and pull requests will be permanently deleted.
              </div>

              <p className="text-sm text-slate-600">
                To confirm, type the repository name{' '}
                <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{repoName}</span>{' '}
                in the box below:
              </p>

              <input
                id="delete-confirm-input"
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={repoName}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && deleteConfirmText === repoName) handleDeleteRepo(); }}
              />

              {deleteError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRepo}
                  disabled={deleteConfirmText !== repoName || isDeleting}
                  className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Deleting…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[17px]">delete_forever</span>
                      I understand, delete this repository
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}