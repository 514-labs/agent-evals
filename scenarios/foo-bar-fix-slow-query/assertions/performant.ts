import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const EXPECTED_DIR = "/scenario/expected";
const TARGET_MS = 100;
const RUNS = 5;

const CANONICAL_QUERY = `
SELECT
  toDate(event_ts) AS day,
  count() AS event_count,
  uniqExact(user_id) AS unique_users
FROM analytics.events
WHERE region = 'us-east'
  AND event_ts >= toDateTime('2026-02-01 00:00:00')
  AND event_ts <  toDateTime('2026-02-08 00:00:00')
GROUP BY day
ORDER BY day
`;

async function exec(ctx: AssertionContext, sql: string): Promise<void> {
  await ctx.clickhouse.command({ query: sql });
}

async function timedRunMs(ctx: AssertionContext): Promise<number> {
  const start = Date.now();
  const result = await ctx.clickhouse.query({
    query: CANONICAL_QUERY,
    format: "JSONEachRow",
  });
  await (result as any).json();
  return Date.now() - start;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export async function query_latency_under_target(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const baselineRaw = readFileSync(`${EXPECTED_DIR}/baseline-ms.txt`, "utf8").trim();
  const baselineMs = Number(baselineRaw);

  const timings: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      await exec(ctx, "SYSTEM DROP MARK CACHE");
      await exec(ctx, "SYSTEM DROP UNCOMPRESSED CACHE");
    } catch {
      // Some configurations restrict SYSTEM commands; the timing is still
      // meaningful even without forced cold caches.
    }
    timings.push(await timedRunMs(ctx));
  }

  const finalMs = median(timings);
  const speedupFactor = baselineMs > 0 ? Number((baselineMs / finalMs).toFixed(2)) : null;
  const improvementPct =
    baselineMs > 0
      ? Number((((baselineMs - finalMs) / baselineMs) * 100).toFixed(1))
      : null;

  const passed = finalMs < TARGET_MS;

  return {
    passed,
    message: passed
      ? `Median latency ${finalMs}ms is under target (${TARGET_MS}ms). Baseline was ${baselineMs}ms.`
      : `Median latency ${finalMs}ms exceeds target (${TARGET_MS}ms). Baseline was ${baselineMs}ms.`,
    details: {
      targetMs: TARGET_MS,
      runs: RUNS,
      timingsMs: timings,
      finalMedianMs: finalMs,
      baselineMs,
      speedupFactor,
      improvementPct,
    },
  };
}
