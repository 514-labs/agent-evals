import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { DRIFT_REPORT_PATH, readDriftReport, runReconciliationCommand } from "./shared";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  const hasRedpanda = Boolean(ctx.env("REDPANDA_BROKER"));
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasPostgres && hasRedpanda && hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing POSTGRES_URL, REDPANDA_BROKER, or CLICKHOUSE_URL.",
    details: { hasPostgres, hasRedpanda, hasClickHouse },
  };
}

export async function reconciliation_entrypoint_is_schedulable(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const run = runReconciliationCommand({
    args: ["--help"],
    timeoutMs: 5000,
  });
  if ("error" in run) {
    return {
      passed: false,
      message: run.error,
    };
  }

  const passed =
    run.status === 0 &&
    (run.path.startsWith("/workspace/scripts/") || run.path.startsWith("/workspace/bin/"));
  return {
    passed,
    message: passed
      ? "Reconciliation entrypoint lives under a schedulable scripts/bin path and responds to `--help`."
      : "Reconciliation entrypoint is missing, misplaced, or not schedulable via a reusable command.",
    details: {
      entrypoint: run.path,
      status: run.status,
    },
  };
}

export async function structured_report_includes_operator_metadata(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const reportResult = readDriftReport();
  if ("error" in reportResult) {
    return {
      passed: false,
      message: reportResult.error,
      details: { expectedPath: DRIFT_REPORT_PATH },
    };
  }

  const report = reportResult.report;
  const passed =
    report.report_path === DRIFT_REPORT_PATH &&
    typeof report.generated_at === "string" &&
    typeof report.summary === "string" &&
    typeof report.tolerance === "number";

  return {
    passed,
    message: passed
      ? "Structured drift report includes operator-facing metadata and the canonical report path."
      : "Structured drift report is missing operator-facing metadata or the canonical report path.",
    details: {
      expectedPath: DRIFT_REPORT_PATH,
      reportPath: report.report_path,
      generatedAt: report.generated_at,
      summary: report.summary,
      tolerance: report.tolerance,
    },
  };
}

export async function healthy_run_uses_meaningful_exit_code(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const run = runReconciliationCommand();
  if ("error" in run) {
    return {
      passed: false,
      message: run.error,
    };
  }

  const passed = run.status === 0 || run.status === 2;
  return {
    passed,
    message: passed
      ? "Healthy reconciliation runs use the expected success/drift exit codes."
      : "Healthy reconciliation runs should exit with 0 (within tolerance) or 2 (drift detected).",
    details: {
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      entrypoint: run.path,
    },
  };
}

export async function dependency_errors_use_meaningful_exit_code(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const run = runReconciliationCommand({
    env: {
      CLICKHOUSE_URL: "http://127.0.0.1:1",
    },
  });
  if ("error" in run) {
    return {
      passed: false,
      message: run.error,
    };
  }

  const combinedOutput = `${run.stdout}\n${run.stderr}`.toLowerCase();
  const passed = run.status === 1 && combinedOutput.includes("clickhouse");
  return {
    passed,
    message: passed
      ? "Dependency failures use exit code 1 with an operator-facing error message."
      : "Dependency failures should use exit code 1 and mention the unavailable system.",
    details: {
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      entrypoint: run.path,
    },
  };
}
