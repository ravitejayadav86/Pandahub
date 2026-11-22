import { describe, expect, it } from "vitest";
import {
  ciApiError, ciCanResolveStaleRun, ciDuration, ciStateLabel, ciSummary, ciTime,
  ciVisualState, ciAttemptVisualState, ciAttemptCountLabel,
  filterCiRuns, type CIAttempt, type CIRun,
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


const makeAttempt = (changes: Partial<CIAttempt> = {}): CIAttempt => ({
  attempt_number: 1,
  started_at: "2026-11-22T16:59:52Z",
  completed_at: "2026-11-22T16:59:56Z",
  conclusion: "failure",
  end_reason: "runner_reported",
  log_excerpt: "Deliberate assertion failed",
  retry_requested_at: "2026-11-22T17:04:42Z",
  retry_reason: "Operator inspected Docker and confirmed shutdown",
  trusted_for_deployment: false,
  ...changes,
});

describe("CI attempt history display remains advisory and read-only", () => {
  it("renders individual failures, successes and timeouts without conflating run status", () => {
    expect(ciAttemptVisualState(makeAttempt())).toBe("failure");
    expect(ciAttemptVisualState(makeAttempt({
      attempt_number: 2, conclusion: "failure",
    }))).toBe("failure");
    expect(ciAttemptVisualState(makeAttempt({
      conclusion: "success",
    }))).toBe("success");
    expect(ciAttemptVisualState(makeAttempt({
      conclusion: "timed_out", end_reason: "admin_unverified_timeout",
    }))).toBe("timed_out");
  });

  it("never fabricates success for incomplete or malformed attempts", () => {
    expect(ciAttemptVisualState(makeAttempt({
      conclusion: null, completed_at: null,
    }))).toBe("running");
    expect(ciAttemptVisualState(makeAttempt({
      conclusion: "success", completed_at: null,
    }))).toBe("running");
    expect(ciAttemptVisualState(makeAttempt({
      conclusion: null,
    }))).toBe("unknown");
  });

  it("shows real persisted attempt counts without guessing for older servers", () => {
    expect(ciAttemptCountLabel(0)).toBe("0");
    expect(ciAttemptCountLabel(1)).toBe("1");
    expect(ciAttemptCountLabel(2)).toBe("2");
    expect(ciAttemptCountLabel(undefined)).toBe("—");
    expect(ciAttemptCountLabel(-2)).toBe("—");
    expect(ciAttemptCountLabel(2.5)).toBe("—");
  });

  it("preserves two historical failures for unchanged commit and a separate success", () => {
    const original = [
      makeAttempt({ attempt_number: 1 }),
      makeAttempt({ attempt_number: 2, retry_reason: null, retry_requested_at: null }),
    ];
    expect(original.map(ciAttemptVisualState)).toEqual(["failure", "failure"]);
    expect(original[0]?.retry_reason).toContain("Docker");
    expect(original.every((attempt) => attempt.trusted_for_deployment === false)).toBe(true);

    const fixedCommit = makeAttempt({
      attempt_number: 1, conclusion: "success", retry_reason: null,
      retry_requested_at: null,
    });
    expect(ciAttemptVisualState(fixedCommit)).toBe("success");
  });
});
