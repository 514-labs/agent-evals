import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

const MOOSE_PROJECT_ROOT = "/workspace/moose-project";

function walkTsFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    let stat;
    try {
      stat = statSync(p);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkTsFiles(p, out);
    } else if (entry.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

export async function orders_has_projection_in_clickhouse(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.projections
     WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  const projectionNames = rows.map((r) => r.name);
  const passed = projectionNames.length >= 1;
  return {
    passed,
    message: passed
      ? `Orders has ${projectionNames.length} projection(s) declared in ClickHouse: ${projectionNames.join(", ")}.`
      : "Orders has no projections declared in ClickHouse — `system.projections` is empty for this table.",
    details: { location: `${found.database}.${found.table}`, projections: projectionNames },
  };
}

export async function projection_declared_in_moose_source(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  // This assertion is the source-of-truth check for the moose-initialized
  // harness, where the projection MUST live in app/index.ts so it survives
  // hot-reload. On other harnesses (e.g. base-rt) there is no Moose project
  // — the agent edits ClickHouse directly via ALTER TABLE — so the check
  // is not applicable and the assertion auto-passes.
  const harness = ctx.env("EVAL_HARNESS");
  if (harness !== "moose-initialized") {
    return {
      passed: true,
      message: `Skipped: Moose-source check only applies to the moose-initialized harness (current: ${harness ?? "unknown"}).`,
      details: { harness },
    };
  }

  const tsFiles = walkTsFiles(`${MOOSE_PROJECT_ROOT}/app`);
  if (tsFiles.length === 0) {
    return {
      passed: false,
      message: `No TypeScript files found under ${MOOSE_PROJECT_ROOT}/app — has the Moose project been removed?`,
      details: {},
    };
  }
  const matches: string[] = [];
  for (const file of tsFiles) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const declaresOlapTable = /OlapTable\s*[<(]/.test(content);
    const referencesOrders = /["']Orders["']|<\s*Order\s*>/.test(content);
    const declaresProjections = /projections\s*:\s*\[\s*\{/.test(content);
    if (declaresOlapTable && referencesOrders && declaresProjections) {
      matches.push(file.replace(MOOSE_PROJECT_ROOT, "<moose-project>"));
    }
  }
  const passed = matches.length >= 1;
  return {
    passed,
    message: passed
      ? `Projection declared in Moose source: ${matches.join(", ")}.`
      : "No Moose source file declares `projections: [{...}]` on the Orders OlapTable. The projection must be expressed in the typed config — not just `ALTER TABLE ... ADD PROJECTION` in raw SQL — or it will drift on the next hot-reload.",
    details: { tsFilesScanned: tsFiles.length, matches },
  };
}

export async function planted_query_returns_expected_shape(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }
  const rows = await queryRows<{ productSku: string; orderTs: string; orderId: string }>(
    ctx,
    `SELECT productSku, orderTs, orderId
     FROM \`${found.database}\`.\`${found.table}\`
     WHERE productSku = '42'
     ORDER BY orderTs DESC
     LIMIT 100`,
  );
  if (rows.length !== 100) {
    return {
      passed: false,
      message: `Expected 100 rows for the planted productSku, got ${rows.length}. The Orders data may have been mutated.`,
      details: { rowCount: rows.length },
    };
  }
  const allMatchSku = rows.every((r) => r.productSku === "42");
  const sortedDesc = rows.every(
    (r, i) => i === 0 || rows[i - 1].orderTs >= r.orderTs,
  );
  const passed = allMatchSku && sortedDesc;
  return {
    passed,
    message: passed
      ? "Planted query still returns 100 rows for productSku=42, sorted by orderTs DESC."
      : `Planted query returned dirty results — allMatchSku=${allMatchSku}, sortedDesc=${sortedDesc}.`,
    details: { allMatchSku, sortedDesc, sampleFirst: rows[0], sampleLast: rows[99] },
  };
}
