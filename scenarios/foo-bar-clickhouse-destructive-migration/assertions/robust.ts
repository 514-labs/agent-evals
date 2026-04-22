import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

export async function select_star_works(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<Record<string, unknown>>(
    ctx,
    `SELECT * FROM \`${db}\`.events LIMIT 1`,
  );
  const passed = rows.length === 1 && Object.keys(rows[0] ?? {}).length >= 4;
  return {
    passed,
    message: passed ? "SELECT * returns a well-shaped row." : "SELECT * failed or row has fewer than 4 columns.",
    details: { rowCount: rows.length, columns: Object.keys(rows[0] ?? {}) },
  };
}

export async function filter_by_event_type_returns_expected_count(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  // Seed data has 4 'pv' rows, 2 'click' rows, 2 'purchase' rows.
  const rows = await queryRows<{ event_type: string; n: number }>(
    ctx,
    `SELECT event_type, count() AS n FROM \`${db}\`.events GROUP BY event_type ORDER BY event_type`,
  );
  const expected = [
    { event_type: "click", n: 2 },
    { event_type: "purchase", n: 2 },
    { event_type: "pv", n: 4 },
  ];
  const actual = rows.map((r) => ({ event_type: r.event_type, n: Number(r.n) }));
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  return {
    passed,
    message: passed ? "Event type counts match seed." : "Event type counts diverged from seed.",
    details: { expected, actual },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
