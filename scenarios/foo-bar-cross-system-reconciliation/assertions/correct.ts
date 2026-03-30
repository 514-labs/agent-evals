import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import {
  DRIFT_REPORT_PATH,
  expectedBehindSystems,
  getLiveCounts,
  readDriftReport,
} from "./shared";

export async function structured_drift_report_exists(
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

  const { report } = reportResult;
  const hasCoreFields =
    typeof report.pg_count === "number" &&
    typeof report.topic_count === "number" &&
    typeof report.ch_count === "number" &&
    typeof report.tolerance === "number" &&
    typeof report.status === "string" &&
    Array.isArray(report.behind_systems) &&
    Array.isArray(report.discrepancies);

  return {
    passed: hasCoreFields,
    message: hasCoreFields
      ? `Structured drift report found at ${DRIFT_REPORT_PATH}.`
      : "Structured drift report is missing one or more required fields.",
    details: {
      expectedPath: DRIFT_REPORT_PATH,
      presentKeys: Object.keys(report),
    },
  };
}

export async function drift_report_matches_live_counts(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const reportResult = readDriftReport();
  if ("error" in reportResult) {
    return {
      passed: false,
      message: reportResult.error,
      details: { expectedPath: DRIFT_REPORT_PATH },
    };
  }

  const counts = await getLiveCounts(ctx);
  const report = reportResult.report;
  const passed =
    report.pg_count === counts.pgCount &&
    report.topic_count === counts.topicCount &&
    report.ch_count === counts.chCount;

  return {
    passed,
    message: passed
      ? "Structured drift report matches the live Postgres, Redpanda, and ClickHouse counts."
      : "Structured drift report does not match the live system counts.",
    details: {
      report: {
        pg_count: report.pg_count,
        topic_count: report.topic_count,
        ch_count: report.ch_count,
      },
      live: counts,
    },
  };
}

export async function discrepancy_context_is_actionable(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const reportResult = readDriftReport();
  if ("error" in reportResult) {
    return {
      passed: false,
      message: reportResult.error,
      details: { expectedPath: DRIFT_REPORT_PATH },
    };
  }

  const counts = await getLiveCounts(ctx);
  const behindSystems = expectedBehindSystems(counts);
  const report = reportResult.report;
  const discrepancies = Array.isArray(report.discrepancies) ? report.discrepancies : [];
  const reportBehindSystems = Array.isArray(report.behind_systems)
    ? report.behind_systems.map((value) => String(value).toLowerCase()).sort()
    : [];
  const expectedSystems = behindSystems.slice().sort();
  const discrepancyShapeValid = discrepancies.every((entry) => {
    return (
      typeof entry?.system === "string" &&
      typeof entry?.expected === "number" &&
      typeof entry?.actual === "number" &&
      typeof entry?.difference === "number"
    );
  });
  const discrepancyCoverageValid =
    expectedSystems.length === 0 ? true : discrepancies.length >= expectedSystems.length;
  const behindSystemsValid =
    reportBehindSystems.length === expectedSystems.length &&
    reportBehindSystems.every((value, index) => value === expectedSystems[index]);

  const passed = discrepancyShapeValid && discrepancyCoverageValid && behindSystemsValid;
  return {
    passed,
    message: passed
      ? "Drift report includes actionable discrepancy context for the current system state."
      : "Drift report is missing actionable discrepancy context or behind-system annotations.",
    details: {
      expectedBehindSystems: expectedSystems,
      reportedBehindSystems: reportBehindSystems,
      discrepancies,
    },
  };
}
