import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readJsonFile, runReconciliationCommand } from "./shared";

export async function reconciliation_command_supports_help_and_tolerance(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const helpRun = runReconciliationCommand({
    args: ["--help"],
    timeoutMs: 5000,
  });
  if ("error" in helpRun) {
    return {
      passed: false,
      message: helpRun.error,
    };
  }

  const output = `${helpRun.stdout}\n${helpRun.stderr}`;
  const passed =
    helpRun.status === 0 &&
    output.includes("--tolerance") &&
    output.includes("--report-path");

  return {
    passed,
    message: passed
      ? "Reconciliation command advertises tolerance and report-path flags."
      : "Reconciliation command help output is missing `--tolerance` or `--report-path` support.",
    details: {
      status: helpRun.status,
      output: output.trim(),
      entrypoint: helpRun.path,
    },
  };
}

export async function dependency_failure_is_operator_friendly(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const failedRun = runReconciliationCommand({
    env: {
      CLICKHOUSE_URL: "http://127.0.0.1:1",
    },
  });
  if ("error" in failedRun) {
    return {
      passed: false,
      message: failedRun.error,
    };
  }

  const combinedOutput = `${failedRun.stdout}\n${failedRun.stderr}`.toLowerCase();
  const passed =
    failedRun.status !== null &&
    failedRun.status !== 0 &&
    combinedOutput.includes("clickhouse");

  return {
    passed,
    message: passed
      ? "Reconciliation command fails cleanly with an operator-facing dependency error."
      : "Reconciliation command does not produce a clear dependency error when ClickHouse is unavailable.",
    details: {
      status: failedRun.status,
      stdout: failedRun.stdout,
      stderr: failedRun.stderr,
      entrypoint: failedRun.path,
    },
  };
}

export async function report_schema_is_stable_across_reruns(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const firstRun = runReconciliationCommand();
  if ("error" in firstRun) {
    return {
      passed: false,
      message: firstRun.error,
    };
  }

  const secondRun = runReconciliationCommand();
  if ("error" in secondRun) {
    return {
      passed: false,
      message: secondRun.error,
    };
  }

  const firstReport = readJsonFile<Record<string, unknown>>(firstRun.reportPath);
  const secondReport = readJsonFile<Record<string, unknown>>(secondRun.reportPath);
  const firstKeys = Object.keys(firstReport ?? {}).sort();
  const secondKeys = Object.keys(secondReport ?? {}).sort();
  const passed =
    (firstRun.status === 0 || firstRun.status === 2) &&
    (secondRun.status === 0 || secondRun.status === 2) &&
    firstKeys.length > 0 &&
    firstKeys.length === secondKeys.length &&
    firstKeys.every((value, index) => value === secondKeys[index]);

  return {
    passed,
    message: passed
      ? "Reconciliation command preserves the structured report schema across reruns."
      : "Reconciliation command changes its structured report shape across reruns or returns an unexpected status.",
    details: {
      firstStatus: firstRun.status,
      secondStatus: secondRun.status,
      firstKeys,
      secondKeys,
      firstReportPath: firstRun.reportPath,
      secondReportPath: secondRun.reportPath,
    },
  };
}
