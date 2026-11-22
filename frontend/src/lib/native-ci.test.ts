import { describe, expect, it } from "vitest";
import {
  ciApiError, ciCanResolveStaleRun, ciDuration, ciStateLabel, ciSummary, ciTime,
  ciVisualState, filterCiRuns, type CIRun,
} from "./native-ci";

const makeRun = (changes: Partial<CIRun> = {}): CIRun => ({
  id: "run-1", branch: "main", sha: "a".repeat(40),
  status: "completed", conclusion: "success", log_excerpt: "2 tests passed",
  created_at: "2026-11-22T10:00:00Z", started_at: "2026-11-22T10:01:00Z",
  completed_at: "2026-11-22T10:01:05Z",
  attestation: "repository_admin_reported",
  trusted_for_deployment: false,
  ...changes,
});

describe("advisory CI dashboard presentation logic", () => {
  it("distinguishes an actual success from queued/running and incomplete data", () => {
    expect(ciVisualState(makeRun())).toBe("success");
    expect(ciVisualState(makeRun({ status: "queued", conclusion: null }))).toBe("queued");
    expect(ciVisualState(makeRun({ status: "running", conclusion: null }))).toBe("running");
    expect(ciVisualState(makeRun({ conclusion: null }))).toBe("unknown");
    expect(ciStateLabel("timed_out")).toBe("Timed out");
  });

  it("counts runner errors and timeouts as failures, not success", () => {
    const rows = [
      makeRun(), makeRun({ id: "2", conclusion: "failure" }),
      makeRun({ id: "3", conclusion: "error" }),
      makeRun({ id: "4", conclusion: "timed_out" }),
      makeRun({ id: "5", status: "running", conclusion: null }),
      makeRun({ id: "6", status: "queued", conclusion: null }),
    ];
    expect(ciSummary(rows)).toEqual({
      passed: 1, failed: 3, active: 2, completed: 4, passRate: 25,
    });
  });

  it("does not display a fabricated pass rate when there are no decided results", () => {
    expect(ciSummary([]).passRate).toBe(null);
    expect(ciSummary([makeRun({ status: "queued", conclusion: null })]).passRate).toBe(null);
  });

  it("filters by branch, SHA, status and matches runner failures", () => {
    const rows = [
      makeRun(),
      makeRun({ id: "run-2", branch: "feature/qa", sha: "b".repeat(40), conclusion: "error" }),
      makeRun({ id: "run-3", branch: "feature/qa", sha: "c".repeat(40), status: "queued", conclusion: null }),
    ];
    expect(filterCiRuns(rows, "", "failed", "all").map((r) => r.id)).toEqual(["run-2"]);
    expect(filterCiRuns(rows, "BBBB", "all", "all").map((r) => r.id)).toEqual(["run-2"]);
    expect(filterCiRuns(rows, "", "active", "feature/qa").map((r) => r.id)).toEqual(["run-3"]);
  });

  it("calculates duration defensively without inventing unavailable times", () => {
    expect(ciDuration(null, null)).toBe("—");
    expect(ciDuration("2026-11-22T10:00:00Z", "2026-11-22T10:01:02Z")).toBe("1m 2s");
    expect(ciDuration("invalid", null)).toBe("—");
    expect(ciDuration("2026-11-22T10:01:00Z", "2026-11-22T10:00:00Z")).toBe("—");
    expect(ciTime("invalid")).toBe("—");
  });

  it("only offers manual recovery for a running job older than ten minutes", () => {
    const now = Date.parse("2026-11-22T11:00:00Z");
    const stale = makeRun({
      status: "running", conclusion: null,
      started_at: "2026-11-22T10:49:59Z", completed_at: null,
    });
    expect(ciCanResolveStaleRun(stale, now)).toBe(true);
    expect(ciCanResolveStaleRun(makeRun({
      ...stale, started_at: "2026-11-22T10:59:00Z",
    }), now)).toBe(false);
    expect(ciCanResolveStaleRun(makeRun({
      ...stale, started_at: null,
    }), now)).toBe(false);
    expect(ciCanResolveStaleRun(makeRun({
      ...stale, status: "completed", conclusion: "success",
    }), now)).toBe(false);
  });

  it("surfaces permission failures and missing CI endpoints accurately", () => {
    expect(ciApiError({ response: { status: 403 } })).toContain("administrator");
    expect(ciApiError({ response: { status: 404 } })).toContain("Native CI");
  });
});
