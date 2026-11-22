/** Typed, presentation-only helpers for PandaHub's advisory native CI API. */

export type CIRunStatus = "queued" | "running" | "completed";
export type CIConclusion = "success" | "failure" | "error" | "timed_out" | null;
export type CIVisualState =
  | "success" | "failure" | "error" | "timed_out"
  | "queued" | "running" | "unknown";

export interface CIRun {
  id: string;
  branch: string;
  sha: string;
  status: CIRunStatus;
  conclusion: CIConclusion;
  log_excerpt: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  attestation: "repository_admin_reported" | string;
  trusted_for_deployment: boolean;
}

export interface CISummary {
  passed: number;
  failed: number;
  active: number;
  completed: number;
  passRate: number | null;
}

export function ciVisualState(run: CIRun): CIVisualState {
  if (run.status === "queued") return "queued";
  if (run.status === "running") return "running";
  if (run.status !== "completed") return "unknown";
  if (
    run.conclusion === "success" || run.conclusion === "failure" ||
    run.conclusion === "error" || run.conclusion === "timed_out"
  ) {
    return run.conclusion;
  }
  return "unknown";
}

export function ciStateLabel(value: CIVisualState): string {
  const labels: Record<CIVisualState, string> = {
    success: "Passed",
    failure: "Failed",
    error: "Runner error",
    timed_out: "Timed out",
    queued: "Queued",
    running: "Running",
    unknown: "Unknown",
  };
  return labels[value];
}

export function ciSummary(runs: CIRun[]): CISummary {
  let passed = 0;
  let failed = 0;
  let active = 0;
  let completed = 0;
  for (const run of runs) {
    const value = ciVisualState(run);
    if (value === "success") passed += 1;
    if (value === "failure" || value === "error" || value === "timed_out") {
      failed += 1;
    }
    if (value === "queued" || value === "running") active += 1;
    if (run.status === "completed") completed += 1;
  }
  const decided = passed + failed;
  return {
    passed, failed, active, completed,
    passRate: decided ? Math.round((passed / decided) * 100) : null,
  };
}

export function filterCiRuns(
  runs: CIRun[],
  search: string,
  state: string,
  branch: string,
): CIRun[] {
  const query = search.trim().toLowerCase();
  return runs.filter((run) => {
    const visual = ciVisualState(run);
    const matchesState =
      state === "all" ||
      (state === "active" && (visual === "queued" || visual === "running")) ||
      (state === "failed" && (visual === "failure" || visual === "error" || visual === "timed_out")) ||
      state === visual;
    return matchesState &&
      (branch === "all" || branch === run.branch) &&
      (!query || run.branch.toLowerCase().includes(query) ||
        run.sha.toLowerCase().includes(query) ||
        run.id.toLowerCase().includes(query));
  });
}

export function ciDuration(
  started: string | null,
  completed: string | null,
  now?: number,
): string {
  if (!started) return "—";
  const start = Date.parse(started);
  const end = completed ? Date.parse(completed) : (now ?? Date.now());
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function ciTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ciApiError(error: unknown): string {
  const response = error as {
    response?: {
      status?: number;
      data?: {
        detail?: string | { msg?: string }[];
        message?: string;
        error?: { message?: string };
      };
    };
  };
  const status = response?.response?.status;
  if (status === 401) return "Your session expired. Sign in to view CI runs.";
  if (status === 403) return "Repository administrator permission is required for this action.";
  if (status === 404) return "Native CI is not available on this PandaHub server or repository.";
  const data = response?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error?.message === "string") return data.error.message;
  return "Could not reach PandaHub CI. Check the backend and try again.";
}
