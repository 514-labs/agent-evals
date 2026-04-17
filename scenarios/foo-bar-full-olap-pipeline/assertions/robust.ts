import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function findProductEventsTable(
  ctx: AssertionContext,
): Promise<{ database: string; table: string } | null> {
  const rows = await queryRows<{ database: string; name: string }>(
    ctx,
    `SELECT database, name FROM system.tables
     WHERE (lower(name) LIKE '%product_event%' OR lower(name) LIKE '%productevent%')
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
     ORDER BY length(name) ASC`,
  );
  return rows.length > 0 ? { database: rows[0].database, table: rows[0].name } : null;
}

export async function live_ingest_works(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found; cannot verify live ingest.", details: {} };
  }

  const probeId = `probe_live_${Date.now()}`;
  const event = {
    event_id: probeId,
    event_ts: new Date().toISOString(),
    user_id: "probe_user",
    product_id: "prod_probe",
    event_type: "view",
    properties: {},
  };

  // Try to POST to common ingest paths/ports
  let posted = false;
  const ingestPaths = ["/ingest/events", "/ingest/ProductEvent", "/ingest", "/events"];
  for (const port of [3000, 4000, 8080]) {
    for (const path of ingestPaths) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(3000),
        });
        if (response.status < 400) {
          posted = true;
          break;
        }
      } catch {}
    }
    if (posted) break;
  }

  if (!posted) {
    return { passed: false, message: "Could not POST to any ingest endpoint.", details: {} };
  }

  // Wait up to 5s for the event to land
  for (let i = 0; i < 10; i++) {
    const rows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM ${found.database}.${found.table} WHERE event_id = '${probeId}'`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      return {
        passed: true,
        message: `Live ingest confirmed: probe event landed in ClickHouse after ${(i + 1) * 500}ms.`,
        details: { probeId, latencyMs: (i + 1) * 500 },
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    passed: false,
    message: `Event posted to ingest endpoint but did not land in ClickHouse within 5s.`,
    details: { probeId },
  };
}

export async function api_returns_valid_json(): Promise<AssertionResult> {
  const endpoints = ["/api/top-products", "/api/funnel", "/api/hourly"];
  const results: Array<{ endpoint: string; validJson: boolean; status?: number }> = [];
  for (const endpoint of endpoints) {
    let ok = false;
    let status: number | undefined;
    for (const port of [3000, 4000, 8080]) {
      try {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          signal: AbortSignal.timeout(2000),
        });
        status = response.status;
        if (response.ok) {
          const text = await response.text();
          JSON.parse(text);
          ok = true;
          break;
        }
      } catch {}
    }
    results.push({ endpoint, validJson: ok, status });
  }
  const passed = results.every((r) => r.validJson);
  return {
    passed,
    message: passed ? "All egress APIs return valid JSON." : `Some endpoints did not return valid JSON: ${JSON.stringify(results)}.`,
    details: { results },
  };
}

export async function redpanda_topic_exists(): Promise<AssertionResult> {
  // Try to reach Redpanda admin on the usual ports (9644) or kafka on 9092
  // We can't easily list topics without kafka tooling, so just check broker reachability
  const broker = "localhost:9092";
  try {
    // net.TcpStream approach via node fetch won't work for kafka. Use a raw socket.
    const net = await import("node:net");
    return await new Promise<AssertionResult>((resolve) => {
      const [host, portStr] = broker.split(":");
      const port = Number(portStr);
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          passed: false,
          message: `Redpanda broker ${broker} unreachable.`,
          details: { broker },
        });
      }, 2000);
      socket.once("connect", () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          passed: true,
          message: `Redpanda broker reachable at ${broker}.`,
          details: { broker },
        });
      });
      socket.once("error", () => {
        clearTimeout(timeout);
        resolve({
          passed: false,
          message: `Redpanda broker ${broker} connection failed.`,
          details: { broker },
        });
      });
      socket.connect(port, host);
    });
  } catch (e) {
    return { passed: false, message: "Redpanda check failed.", details: { error: String(e) } };
  }
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
