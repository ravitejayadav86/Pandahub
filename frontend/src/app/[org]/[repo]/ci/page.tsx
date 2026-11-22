"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity, AlertCircle, ArrowLeft, ArrowUpRight, Check, CheckCircle2,
  ChevronRight, Circle, Clock3, Copy, GitBranch, GitCommitHorizontal,
  Loader2, LockKeyhole, Play, RefreshCw, Search, ShieldAlert,
  SlidersHorizontal, TerminalSquare, Workflow, XCircle,
} from "lucide-react";
import api from "@/lib/api";
import {
  ciApiError, ciDuration, ciStateLabel, ciSummary, ciTime,
  ciVisualState, filterCiRuns, type CIRun, type CIVisualState,
} from "@/lib/native-ci";

const MAX_RUNS = 100;
const PAGE_SIZE = 10;
type Filter = "all" | "active" | "success" | "failed";
type Clip = "sha" | "logs" | "command" | null;

function StatusIcon({ state, className = "h-4 w-4" }: {
  state: CIVisualState; className?: string;
}) {
  if (state === "success") return <CheckCircle2 className={className} aria-hidden="true" />;
  if (state === "failure" || state === "error" || state === "timed_out") {
    return <XCircle className={className} aria-hidden="true" />;
  }
  if (state === "running") return <Loader2 className={className} aria-hidden="true" />;
  if (state === "queued") return <Clock3 className={className} aria-hidden="true" />;
  return <Circle className={className} aria-hidden="true" />;
}

function StatusPill({ state }: { state: CIVisualState }) {
  const bright = state === "success";
  const pending = state === "queued" || state === "running";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
      bright
        ? "border-white/40 bg-white text-black"
        : pending
          ? "border-zinc-600 bg-zinc-800 text-zinc-100"
          : "border-white/15 bg-zinc-900 text-zinc-300"
    }`}>
      <StatusIcon state={state} className="h-3.5 w-3.5" />
      {ciStateLabel(state)}
    </span>
  );
}

function Metric({ caption, number, note, icon: Icon }: {
  caption: string;
  number: string | number;
  note: string;
  icon: typeof Activity;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111] px-5 py-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{caption}</span>
        <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-tight text-white">{number}</div>
      <div className="mt-2 text-[11px] text-zinc-500">{note}</div>
    </div>
  );
}

export default function NativeCIDashboard() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org || "";
  const repo = params?.repo || "";
  const base = `/${owner}/${repo}`;
  const apiBase = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/ci`;

  const [runs, setRuns] = useState<CIRun[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Filter>("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<Clip>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (first = false) => {
    if (!owner || !repo) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (first) setLoading(true);
    else setRefreshing(true);
    try {
      const [settings, history] = await Promise.all([
        api.get<{ enabled: boolean }>(`${apiBase}/settings`, {
          signal: controller.signal,
        }),
        api.get<CIRun[]>(`${apiBase}/runs`, {
          signal: controller.signal, params: { limit: MAX_RUNS },
        }),
      ]);
      if (controller.signal.aborted) return;
      const recorded = Array.isArray(history.data) ? history.data : [];
      setEnabled(settings.data.enabled === true);
      setRuns(recorded);
      setSelectedId((previous) =>
        previous && recorded.some((run) => run.id === previous)
          ? previous : (recorded[0]?.id ?? null)
      );
      setError(null);
    } catch (exc) {
      if (!controller.signal.aborted) setError(ciApiError(exc));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [apiBase, owner, repo]);

  useEffect(() => {
    setRuns([]);
    setSelectedId(null);
    setError(null);
    setLoading(true);
    void load(true);
    return () => { requestRef.current?.abort(); };
  }, [load]);

  const summary = useMemo(() => ciSummary(runs), [runs]);
  const branches = useMemo(
    () => [...new Set(runs.map((run) => run.branch))].sort(),
    [runs],
  );
  const filteredRuns = useMemo(
    () => filterCiRuns(runs, query, statusFilter, branchFilter),
    [runs, query, statusFilter, branchFilter],
  );
  const pages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const visibleRuns = filteredRuns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? null,
    [runs, selectedId],
  );

  // Only poll while a job is actually pending. No perpetual animation or polling.
  useEffect(() => {
    if (summary.active === 0) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [summary.active, load]);

  const toggleCI = async () => {
    if (saving || loading) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = await api.patch<{ enabled: boolean }>(`${apiBase}/settings`, {
        enabled: !enabled,
      });
      setEnabled(result.data.enabled === true);
    } catch (exc) {
      setActionError(ciApiError(exc));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string, target: Clip) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied((previous) => previous === target ? null : previous), 2000);
    } catch {
      setActionError("Could not copy. Your browser may require a secure connection.");
    }
  };

  const terminalCommand = `python scripts/panda_ci_runner.py --repo ${owner}/${repo}`;
  const selectedState = selected ? ciVisualState(selected) : null;

  const selectFilter = (value: Filter) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      {/* Static only: premium depth without scroll-bound effects or animated canvases. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
        style={{
          background: "radial-gradient(ellipse at 84% 0%, rgba(255,255,255,0.10), transparent 43%), linear-gradient(180deg, #121212, #050505)",
        }}
      />
      <div className="mx-auto max-w-[1460px] px-4 pb-20 pt-7 sm:px-7 lg:px-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Link href="/dashboard" className="hover:text-white">Workspace</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href={base} className="max-w-[230px] truncate hover:text-white">{owner}/{repo}</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-current="page" className="font-medium text-zinc-100">CI / Pipelines</span>
        </nav>

        <header className="mt-10 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <Workflow className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.23em] text-zinc-400">PandaHub / Engineering</span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              CI <span className="text-zinc-500">Pipelines.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
              Your commit-to-test history, live queue, and runner logs in one place.
              Every result below comes from your repository&apos;s PandaHub CI records.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-300">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Advisory results — not deployment approval
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-300">
                <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-white" : "bg-zinc-600"}`} />
                CI on push {enabled ? "enabled" : "disabled"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={base}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 no-underline hover:border-white/35 hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Repository
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mt-7 flex items-start gap-3 rounded-xl border border-white/20 bg-zinc-900 p-4 text-sm text-zinc-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Unable to refresh CI data</p>
              <p className="mt-1 text-zinc-400">{error}</p>
            </div>
          </div>
        )}
        {actionError && (
          <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-white/20 bg-zinc-900 p-4 text-sm text-zinc-300">
            <span>{actionError}</span>
            <button className="underline underline-offset-2 hover:text-white" onClick={() => setActionError(null)} type="button">Dismiss</button>
          </div>
        )}

        <section aria-label="CI summary" className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric caption="Latest run" icon={GitCommitHorizontal}
            number={loading && runs.length === 0 ? "…" : runs.length ? ciStateLabel(ciVisualState(runs[0])) : "—"}
            note={runs.length ? `Commit ${runs[0].sha.slice(0, 10)}` : "No recorded runs"} />
          <Metric caption="Passed" icon={CheckCircle2} number={loading && !runs.length ? "…" : summary.passed}
            note="Recorded successful runs" />
          <Metric caption="Failed" icon={XCircle} number={loading && !runs.length ? "…" : summary.failed}
            note="Failures, errors and timeouts" />
          <Metric caption="In queue" icon={Activity} number={loading && !runs.length ? "…" : summary.active}
            note={summary.passRate === null ? "No decided runs yet" : `${summary.passRate}% pass rate of decided runs`} />
        </section>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#101010] p-4 sm:p-5" aria-label="Automatic CI setting">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl border border-white/15 bg-zinc-900 p-2.5">
              <Play className="h-4 w-4 text-zinc-300" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Automatic CI job creation</h2>
              <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-400">
                {enabled
                  ? "New accepted branch-tip pushes create queued records. A separate local runner must execute them."
                  : "Off by default. Enable to create a CI job for each new accepted branch tip. Runner execution is separate."}
                {" "}Only repository administrators can change this setting.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleCI()}
            disabled={saving || loading || !!error}
            aria-label={enabled ? "Disable automatic CI jobs" : "Enable automatic CI jobs"}
            className={`h-10 shrink-0 rounded-xl border px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled
                ? "border-white/20 bg-zinc-900 text-white hover:bg-zinc-800"
                : "border-white bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {saving ? "Saving…" : enabled ? "Disable CI" : "Enable CI"}
          </button>
        </section>

        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1.13fr)_minmax(340px,0.87fr)]">
          <section aria-labelledby="run-history-title" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-4 w-4 text-zinc-300" aria-hidden="true" />
                    <h2 id="run-history-title" className="text-base font-semibold text-white">Run history</h2>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    Latest {MAX_RUNS} records at most · {runs.length} loaded · {filteredRuns.length} matching
                  </p>
                </div>
                {summary.active > 0 && (
                  <span className="rounded-full border border-white/15 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300">
                    Refreshing while jobs are active
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter CI runs by outcome">
                {([
                  ["all", "All runs"],
                  ["active", "Active"],
                  ["success", "Passed"],
                  ["failed", "Failed"],
                ] as const).map(([value, label]) => (
                  <button
                    type="button" key={value}
                    aria-pressed={statusFilter === value}
                    onClick={() => selectFilter(value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      statusFilter === value
                        ? "border-white/60 bg-white text-black"
                        : "border-white/10 bg-[#171717] text-zinc-400 hover:border-white/30 hover:text-white"
                    }`}
                  >{label}</button>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <span className="sr-only">Search runs by commit, branch, or job ID</span>
                  <input
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                    placeholder="Search commit, branch, run ID…"
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#090909] pl-9 pr-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/50"
                  />
                </label>
                <label className="relative block">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <span className="sr-only">Filter by branch</span>
                  <select
                    value={branchFilter}
                    onChange={(event) => { setBranchFilter(event.target.value); setPage(1); }}
                    className="h-10 w-full min-w-0 appearance-none rounded-lg border border-white/10 bg-[#090909] pl-9 pr-3 text-xs text-zinc-300 outline-none focus:border-white/50"
                  >
                    <option value="all">All branches</option>
                    {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {loading && runs.length === 0 ? (
              <div className="space-y-3 p-6" role="status" aria-live="polite">
                <div className="h-16 rounded-xl bg-zinc-900" />
                <div className="h-16 rounded-xl bg-zinc-900" />
                <p className="text-sm text-zinc-500">Loading recorded CI runs…</p>
              </div>
            ) : !error && runs.length === 0 ? (
              <div className="px-8 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-zinc-900">
                  <GitBranch className="h-6 w-6 text-zinc-400" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-white">No CI runs yet</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Enable automatic CI, push a new commit, and launch the separate local test runner.
                </p>
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">
                No CI runs match these filters.
              </div>
            ) : (
              <div role="list" aria-label="CI run records" className="divide-y divide-white/[0.07]">
                {visibleRuns.map((run) => {
                  const visual = ciVisualState(run);
                  const active = selectedId === run.id;
                  return (
                    <button
                      type="button"
                      role="listitem"
                      key={run.id}
                      aria-current={active ? "true" : undefined}
                      onClick={() => setSelectedId(run.id)}
                      className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors sm:px-6 ${
                        active ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        visual === "success"
                          ? "border-white/30 bg-white text-black"
                          : "border-white/10 bg-zinc-900 text-zinc-300"
                      }`}>
                        <StatusIcon state={visual} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-[13px] font-semibold text-white">{run.sha.slice(0, 12)}</span>
                          <StatusPill state={visual} />
                        </div>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          <span className="inline-flex max-w-full items-center gap-1 truncate">
                            <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{run.branch}</span>
                          </span>
                          <span>{ciTime(run.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-zinc-600"}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-xs text-zinc-500">
                <span>Page {page} of {pages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </section>

          <aside aria-label="Selected CI run" className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <TerminalSquare className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-white">Execution details</h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Run inspector</span>
              </div>
              {!selected ? (
                <div className="p-8 text-sm text-zinc-500">
                  Select a CI run to inspect its result and saved output.
                </div>
              ) : (
                <>
                  <div className="space-y-5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {selectedState && <StatusPill state={selectedState} />}
                      <span className="text-[11px] text-zinc-500">{ciDuration(selected.started_at, selected.completed_at)} execution</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-zinc-500">Commit</span>
                        <button type="button" onClick={() => void copy(selected.sha, "sha")}
                          className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-zinc-200 hover:text-white">
                          <span className="truncate">{selected.sha.slice(0, 16)}</span>
                          {copied === "sha" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-zinc-500">Branch</span>
                        <span className="max-w-[65%] break-all text-right font-mono text-xs text-zinc-200">{selected.branch}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-zinc-500">Created</span>
                        <time className="text-right text-xs text-zinc-300">{ciTime(selected.created_at)}</time>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-zinc-500">Completed</span>
                        <time className="text-right text-xs text-zinc-300">{ciTime(selected.completed_at)}</time>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-zinc-500">Run ID</span>
                        <span className="max-w-[65%] break-all text-right font-mono text-[10px] text-zinc-500">{selected.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-y border-white/10 bg-[#080808]">
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Test output</span>
                      <button type="button" disabled={!selected.log_excerpt}
                        onClick={() => void copy(selected.log_excerpt ?? "", "logs")}
                        className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40">
                        {copied === "logs" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "logs" ? "Copied" : "Copy logs"}
                      </button>
                    </div>
                    <pre aria-label="Saved CI test output"
                      className="max-h-[340px] min-h-[160px] overflow-auto whitespace-pre-wrap break-all px-5 pb-5 font-mono text-[11px] leading-[1.8] text-zinc-300">
                      {selected.log_excerpt || "No runner output recorded for this run."}
                    </pre>
                  </div>
                  <div className="flex items-start gap-2 px-5 py-4 text-[11px] leading-5 text-zinc-500">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Administrator-reported result. Not independently attested and not valid as deployment approval.
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TerminalSquare className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-white">Run locally</h2>
                </div>
                <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-zinc-400">MVP</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-zinc-500">
                PandaHub queues new commits when CI is enabled. Start the separate Docker runner
                on your own trusted development machine; the dashboard cannot execute jobs remotely.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-zinc-300">{terminalCommand}</code>
                <button type="button" aria-label="Copy local runner command" onClick={() => void copy(terminalCommand, "command")}
                  className="shrink-0 rounded-md border border-white/15 p-2 text-zinc-300 hover:bg-white/10 hover:text-white">
                  {copied === "command" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-zinc-600">
                Python standard-library tests only · manually started · advisory · no deployment automation
              </p>
            </div>
          </aside>
        </div>
        <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[11px] text-zinc-600">
          <span className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> CI jobs are not a production security boundary.</span>
          <Link href={`${base}/insights`} className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white">
            View AI Insights <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </main>
  );
}
