import { existsSync, readFileSync, statSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

const REPORT_PATH = "/workspace/report.md";
const MIN_REPORT_BYTES = 80;

export async function report_md_present_with_findings(): Promise<AssertionResult> {
  if (!existsSync(REPORT_PATH)) {
    return {
      passed: false,
      message: `${REPORT_PATH} is missing. Document the change and the before/after performance there.`,
      details: { path: REPORT_PATH, exists: false },
    };
  }
  let size = 0;
  let content = "";
  try {
    size = statSync(REPORT_PATH).size;
    content = readFileSync(REPORT_PATH, "utf8");
  } catch {
    return {
      passed: false,
      message: `${REPORT_PATH} could not be read.`,
      details: { path: REPORT_PATH },
    };
  }
  if (size < MIN_REPORT_BYTES) {
    return {
      passed: false,
      message: `${REPORT_PATH} is too short (${size} bytes < ${MIN_REPORT_BYTES} bytes). Include the projection definition and the before/after timing.`,
      details: { path: REPORT_PATH, size },
    };
  }
  const lower = content.toLowerCase();
  const mentionsProjection = lower.includes("projection");
  const mentionsPerf =
    /\b\d+(\.\d+)?\s*(ms|millisecond|ms\b|μs|s\b|second|x)/i.test(content) ||
    lower.includes("speedup") ||
    lower.includes("faster") ||
    lower.includes("read_rows") ||
    lower.includes("rows scanned");
  const passed = mentionsProjection && mentionsPerf;
  return {
    passed,
    message: passed
      ? `${REPORT_PATH} documents the projection and a performance signal.`
      : `${REPORT_PATH} exists but is missing required content (mentions projection: ${mentionsProjection}, mentions performance number: ${mentionsPerf}).`,
    details: { path: REPORT_PATH, size, mentionsProjection, mentionsPerf },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
