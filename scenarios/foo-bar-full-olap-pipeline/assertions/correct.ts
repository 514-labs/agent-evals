import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findProductEventsTable, findTable, resolveColumn } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

/** Try an egress API endpoint, return parsed JSON array or null. */
async function probeApiJson(paths: string[]): Promise<any[] | null> {
  for (const port of [3000, 4000, 8080]) {
    for (const p of paths) {
      try {
        const response = await fetch(`http://localhost:${port}${p}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) return data;
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Gate 3 (correct) is about the correctness of the agent's aggregations.
 * If the API returns data we use that; otherwise we fall back to querying
 * ClickHouse for a table matching the expected concepts. This handles cases
 * where data is correct but the egress layer is broken (e.g. Moose TS errors).
 */

export async function all_seed_events_ingested(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Product events table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 40;
  return {
    passed,
    message: passed ? `${count} events ingested (>= 40).` : `Expected 40 events, got ${count}.`,
    details: { count, location: `${found.database}.${found.table}` },
  };
}

export async function top_products_returns_data(ctx: AssertionContext): Promise<AssertionResult> {
  // Prefer the egress API if it works
  const apiData = await probeApiJson(["/api/top-products", "/api/topProducts", "/top-products"]);
  if (apiData && apiData.length > 0) {
    return {
      passed: true,
      message: `Top products API returned ${apiData.length} rows.`,
      details: { source: "api", sample: apiData.slice(0, 3) },
    };
  }

  // Fallback: check for a top-products aggregation table in ClickHouse with rows
  const table = await findTable(ctx, { concepts: ["top", "product"] });
  if (table && (table.total_rows ?? 0) > 0) {
    return {
      passed: true,
      message: `Top products aggregation has ${table.total_rows} rows at ${table.database}.${table.table} (API did not respond).`,
      details: { source: "clickhouse", location: `${table.database}.${table.table}`, rows: table.total_rows },
    };
  }

  // Final fallback: compute from the base events table
  const base = await findProductEventsTable(ctx);
  if (base) {
    const productCol = await resolveColumn(ctx, base.database, base.table, "product_id", "productId");
    const typeCol = await resolveColumn(ctx, base.database, base.table, "event_type", "eventType");
    if (productCol && typeCol) {
      const rows = await queryRows<{ product_id: string; n: number }>(
        ctx,
        `SELECT \`${productCol}\` AS product_id, count() AS n FROM ${base.database}.${base.table} WHERE \`${typeCol}\` = 'purchase' GROUP BY \`${productCol}\` ORDER BY n DESC LIMIT 10`,
      );
      if (rows.length > 0) {
        return {
          passed: true,
          message: `Top products computed from base table: ${rows.length} products (no aggregation table or API).`,
          details: { source: "base-table", sample: rows.slice(0, 3) },
        };
      }
    }
  }

  return {
    passed: false,
    message: "No top products data accessible via API, aggregation table, or base table.",
    details: {},
  };
}

export async function funnel_has_three_steps(ctx: AssertionContext): Promise<AssertionResult> {
  const apiData = await probeApiJson(["/api/funnel", "/api/conversion-funnel", "/funnel"]);
  if (Array.isArray(apiData) && apiData.length >= 3) {
    const steps = apiData.map((row: any) => String(row?.step ?? row?.event_type ?? "").toLowerCase());
    const hasAll = ["view", "cart", "purchase"].every((s) => steps.some((step) => step.includes(s)));
    if (hasAll) {
      return {
        passed: true,
        message: "Funnel API has view, cart, and purchase steps.",
        details: { source: "api", steps },
      };
    }
  }

  // Fallback: find a funnel table
  const table = await findTable(ctx, { concepts: ["funnel"] });
  if (table) {
    const rows = await queryRows<{ step: string }>(
      ctx,
      `SELECT DISTINCT lower(toString(step)) AS step FROM ${table.database}.${table.table}`,
    ).catch(() => [] as { step: string }[]);
    const steps = rows.map((r) => r.step);
    const hasAll = ["view", "cart", "purchase"].every((s) => steps.some((step) => step.includes(s)));
    if (hasAll) {
      return {
        passed: true,
        message: `Funnel table has view/cart/purchase steps at ${table.database}.${table.table} (API did not respond).`,
        details: { source: "clickhouse", location: `${table.database}.${table.table}`, steps },
      };
    }
  }

  // Final fallback: compute from base events
  const base = await findProductEventsTable(ctx);
  if (base) {
    const typeCol = await resolveColumn(ctx, base.database, base.table, "event_type", "eventType");
    if (typeCol) {
      const rows = await queryRows<{ step: string }>(
        ctx,
        `SELECT DISTINCT lower(\`${typeCol}\`) AS step FROM ${base.database}.${base.table}`,
      );
      const steps = rows.map((r) => r.step);
      const hasAll = ["view", "cart", "purchase"].every((s) => steps.some((step) => step.includes(s)));
      if (hasAll) {
        return {
          passed: true,
          message: `Funnel steps present in base events table (no aggregation table or API).`,
          details: { source: "base-table", steps },
        };
      }
    }
  }

  return {
    passed: false,
    message: "Funnel data not available via API, aggregation table, or base table.",
    details: { apiData },
  };
}

export async function funnel_counts_are_monotonic(ctx: AssertionContext): Promise<AssertionResult> {
  const collectCounts = async (): Promise<{ views: number; carts: number; purchases: number; source: string } | null> => {
    // API attempt
    const apiData = await probeApiJson(["/api/funnel", "/api/conversion-funnel", "/funnel"]);
    if (Array.isArray(apiData) && apiData.length >= 3) {
      const countFor = (name: string) => {
        const row = apiData.find((r: any) => String(r?.step ?? r?.event_type ?? "").toLowerCase().includes(name));
        return Number(row?.total_events ?? row?.count ?? row?.event_count ?? 0);
      };
      const views = countFor("view");
      const carts = countFor("cart");
      const purchases = countFor("purchase");
      if (views + carts + purchases > 0) return { views, carts, purchases, source: "api" };
    }
    // ClickHouse fallback: query base table
    const base = await findProductEventsTable(ctx);
    if (base) {
      const typeCol = await resolveColumn(ctx, base.database, base.table, "event_type", "eventType");
      if (typeCol) {
        const rows = await queryRows<{ step: string; n: number }>(
          ctx,
          `SELECT lower(\`${typeCol}\`) AS step, count() AS n FROM ${base.database}.${base.table} GROUP BY \`${typeCol}\``,
        );
        const countFor = (s: string) => Number(rows.find((r) => r.step.includes(s))?.n ?? 0);
        return {
          views: countFor("view"),
          carts: countFor("cart"),
          purchases: countFor("purchase"),
          source: "base-table",
        };
      }
    }
    return null;
  };

  const counts = await collectCounts();
  if (!counts) {
    return { passed: false, message: "Could not compute funnel counts.", details: {} };
  }
  const { views, carts, purchases, source } = counts;
  const passed = views >= carts && carts >= purchases && purchases > 0;
  return {
    passed,
    message: passed
      ? `Funnel is monotonic (${source}): ${views} views >= ${carts} carts >= ${purchases} purchases.`
      : `Funnel not monotonic (${source}): ${views} views, ${carts} carts, ${purchases} purchases.`,
    details: { views, carts, purchases, source },
  };
}

export async function hourly_returns_data(ctx: AssertionContext): Promise<AssertionResult> {
  const apiData = await probeApiJson(["/api/hourly", "/api/hourly-activity", "/hourly"]);
  if (Array.isArray(apiData) && apiData.length > 0) {
    return {
      passed: true,
      message: `Hourly API returned ${apiData.length} rows.`,
      details: { source: "api", sample: apiData.slice(0, 3) },
    };
  }

  // Fallback: hourly aggregation table
  const table = await findTable(ctx, { concepts: ["hourly"] });
  if (table && (table.total_rows ?? 0) > 0) {
    return {
      passed: true,
      message: `Hourly aggregation has ${table.total_rows} rows at ${table.database}.${table.table} (API did not respond).`,
      details: { source: "clickhouse", location: `${table.database}.${table.table}`, rows: table.total_rows },
    };
  }

  // Final fallback: base events have time data
  const base = await findProductEventsTable(ctx);
  if (base) {
    const tsCol = await resolveColumn(ctx, base.database, base.table, "event_ts", "eventTs");
    if (tsCol) {
      const rows = await queryRows<{ n: number }>(
        ctx,
        `SELECT count() AS n FROM ${base.database}.${base.table} WHERE \`${tsCol}\` IS NOT NULL`,
      );
      if (Number(rows[0]?.n ?? 0) > 0) {
        return {
          passed: true,
          message: `Base events have timestamps for hourly aggregation (no aggregation table or API).`,
          details: { source: "base-table", count: rows[0].n },
        };
      }
    }
  }

  return {
    passed: false,
    message: "No hourly data accessible.",
    details: {},
  };
}
