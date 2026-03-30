import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { AssertionContext } from "@dec-bench/eval-core";

export const WORKSPACE_ROOT = "/workspace";
export const DRIFT_REPORT_PATH = join(WORKSPACE_ROOT, "artifacts", "drift-report.json");
const ENTRYPOINT_CANDIDATES = [
  join(WORKSPACE_ROOT, "scripts", "reconcile.py"),
  join(WORKSPACE_ROOT, "scripts", "reconcile.sh"),
  join(WORKSPACE_ROOT, "scripts", "reconcile.js"),
  join(WORKSPACE_ROOT, "scripts", "reconcile.mjs"),
  join(WORKSPACE_ROOT, "bin", "reconcile.py"),
  join(WORKSPACE_ROOT, "bin", "reconcile.sh"),
  join(WORKSPACE_ROOT, "bin", "reconcile.js"),
  join(WORKSPACE_ROOT, "bin", "reconcile.mjs"),
];

export interface DriftReport {
  status?: string;
  generated_at?: string;
  tolerance?: number;
  pg_count?: number;
  topic_count?: number;
  ch_count?: number;
  behind_systems?: string[];
  discrepancies?: Array<{
    system?: string;
    expected?: number;
    actual?: number;
    difference?: number;
    details?: string;
  }>;
  summary?: string;
  report_path?: string;
}

export function readDriftReport():
  | { report: DriftReport; raw: string }
  | { error: string } {
  if (!existsSync(DRIFT_REPORT_PATH)) {
    return {
      error: `Expected structured drift report at ${DRIFT_REPORT_PATH}.`,
    };
  }

  try {
    const raw = readFileSync(DRIFT_REPORT_PATH, "utf8");
    return {
      report: JSON.parse(raw) as DriftReport,
      raw,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not parse ${DRIFT_REPORT_PATH}: ${error.message}`
          : `Could not parse ${DRIFT_REPORT_PATH}.`,
    };
  }
}

export async function getLiveCounts(ctx: AssertionContext): Promise<{
  pgCount: number;
  topicCount: number;
  chCount: number;
}> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.transactions");
  const pgCount = Number(pgResult.rows[0]?.n ?? 0);

  const chRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.transactions",
  );
  const chCount = Number(chRows[0]?.n ?? 0);

  const topicCount = getTopicCount(ctx.env("REDPANDA_BROKER") ?? "localhost:9092");
  return { pgCount, topicCount, chCount };
}

export function expectedBehindSystems(counts: {
  pgCount: number;
  topicCount: number;
  chCount: number;
}): string[] {
  const behind: string[] = [];
  if (counts.topicCount < counts.pgCount) {
    behind.push("redpanda");
  }
  if (counts.chCount < counts.pgCount) {
    behind.push("clickhouse");
  }
  return behind;
}

export function findReconciliationEntrypoint():
  | { path: string; runtime: "python3" | "bash" | "node" }
  | null {
  for (const candidate of ENTRYPOINT_CANDIDATES) {
    if (!existsSync(candidate)) {
      continue;
    }
    if (candidate.endsWith(".py")) {
      return { path: candidate, runtime: "python3" };
    }
    if (candidate.endsWith(".sh")) {
      return { path: candidate, runtime: "bash" };
    }
    return { path: candidate, runtime: "node" };
  }
  return null;
}

export function readEntrypointSource(): { path: string; content: string } | null {
  const entrypoint = findReconciliationEntrypoint();
  if (!entrypoint) {
    return null;
  }
  return {
    path: entrypoint.path,
    content: readFileSync(entrypoint.path, "utf8"),
  };
}

export function runReconciliationCommand(options?: {
  args?: string[];
  env?: Record<string, string>;
  reportPath?: string;
  timeoutMs?: number;
}) {
  const entrypoint = findReconciliationEntrypoint();
  if (!entrypoint) {
    return {
      error:
        "Expected a reusable reconciliation entrypoint under /workspace/scripts or /workspace/bin.",
    };
  }

  const reportPath = options?.reportPath ?? createTempReportPath();
  mkdirSync(join(WORKSPACE_ROOT, "artifacts"), { recursive: true });
  mkdirSync(join(tmpdir(), "dec-bench-reconciliation"), { recursive: true });

  const child = spawnSync(
    entrypoint.runtime,
    [entrypoint.path, "--report-path", reportPath, ...(options?.args ?? [])],
    {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
      timeout: options?.timeoutMs ?? 10_000,
      env: {
        ...process.env,
        ...options?.env,
      },
    },
  );

  return {
    path: entrypoint.path,
    reportPath,
    status: child.status,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    timedOut: child.signal === "SIGTERM" || child.signal === "SIGKILL",
    error: child.error?.message,
  };
}

export function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function createTempReportPath(): string {
  return join(
    tmpdir(),
    "dec-bench-reconciliation",
    `drift-report-${Date.now()}-${Math.floor(Math.random() * 1000)}.json`,
  );
}

function getTopicCount(broker: string): number {
  try {
    const out = execSync(
      `python3 -c "
from kafka import KafkaConsumer
c = KafkaConsumer('transactions', bootstrap_servers=['${broker}'], auto_offset_reset='earliest', consumer_timeout_ms=3000)
count = sum(1 for _ in c)
c.close()
print(count)
"`,
      { encoding: "utf8", timeout: 5000 },
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}
