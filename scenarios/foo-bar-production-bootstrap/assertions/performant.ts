import { existsSync, readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const DEPLOYED_URL_FILE = "/workspace/.deployed-url";
const RESPONSE_TIME_BUDGET_MS = 2_000;

function readDeployedUrl(): string | null {
  if (!existsSync(DEPLOYED_URL_FILE)) return null;
  return readFileSync(DEPLOYED_URL_FILE, "utf8").trim() || null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function query_endpoint_responds_under_budget(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (!url) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const queryUrl = `${trimSlash(url)}/api/bar?orderBy=totalRows&startDay=1&endDay=31&limit=5`;
  const started = Date.now();
  try {
    const res = await fetch(queryUrl);
    const elapsedMs = Date.now() - started;
    const passed = res.status === 200 && elapsedMs <= RESPONSE_TIME_BUDGET_MS;
    return {
      passed,
      message: passed
        ? `/api/bar responded in ${elapsedMs}ms (budget ${RESPONSE_TIME_BUDGET_MS}ms).`
        : res.status !== 200
          ? `/api/bar returned ${res.status} after ${elapsedMs}ms — not serving the read path.`
          : `/api/bar took ${elapsedMs}ms — exceeds ${RESPONSE_TIME_BUDGET_MS}ms budget.`,
      details: { elapsedMs, status: res.status, queryUrl },
    };
  } catch (err) {
    return {
      passed: false,
      message: `/api/bar unreachable: ${(err as Error).message}.`,
      details: { queryUrl, error: (err as Error).message },
    };
  }
}
