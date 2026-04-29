import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { fetchWithWarmupRetry } from "../../_shared/assertion-helpers";
import { tryResolveEndpoints } from "./shared";

const PROPAGATION_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Walk a JSON value and look for evidence that it reflects the ingested
 * probe. Two heuristics, in order of strictness:
 *   1. The probe's `primaryKey` appears anywhere in the response (strongest
 *      signal — agent surfaces individual events).
 *   2. There's a numeric field named like a counter (`count`, `total`,
 *      `totalRows`, `rows`, `n`) with a positive value (Moose-style
 *      aggregations and most "events today" counters).
 */
function responseReflectsIngest(body: unknown, primaryKey: string): boolean {
  const json = JSON.stringify(body ?? null);
  if (json.includes(primaryKey)) return true;

  const COUNTER_KEYS = new Set([
    "count",
    "total",
    "totalrows",
    "rows",
    "n",
    "events",
    "eventcount",
    "rowcount",
  ]);

  let found = false;
  const visit = (node: unknown) => {
    if (found) return;
    if (Array.isArray(node)) {
      if (node.length > 0) {
        for (const item of node) visit(item);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (typeof value === "number" && value > 0 && COUNTER_KEYS.has(key.toLowerCase())) {
          found = true;
          return;
        }
        visit(value);
      }
    }
  };
  visit(body);
  return found;
}

async function fetchQuery(url: string): Promise<{ status: number; body: unknown; raw: string }> {
  const res = await fetch(url);
  const raw = await res.text();
  let body: unknown = null;
  if (raw.length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  return { status: res.status, body, raw };
}

export async function ingest_lands_in_aggregate(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) {
    return { passed: false, message: "No deployed URL recorded.", details: {} };
  }

  const probe = {
    primaryKey: `bench-probe-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    optionalText: "dec-bench correct-gate round-trip probe",
  };

  let ingestStatus: number;
  let ingestBody: string;
  let ingestAttempts: number;
  try {
    const res = await fetchWithWarmupRetry(endpoints.ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(probe),
    });
    ingestStatus = res.status;
    ingestBody = res.body.trim();
    ingestAttempts = res.attempts;
  } catch (err) {
    return {
      passed: false,
      message: `POST ${endpoints.ingestUrl} unreachable: ${(err as Error).message}`,
      details: { stage: "ingest", error: (err as Error).message },
    };
  }
  if (ingestStatus < 200 || ingestStatus >= 300) {
    return {
      passed: false,
      message: `POST ${endpoints.ingestUrl} did not accept the probe (status=${ingestStatus} body=${ingestBody.slice(0, 120)}) after ${ingestAttempts} attempt(s).`,
      details: { stage: "ingest", status: ingestStatus, body: ingestBody.slice(0, 200), probe, attempts: ingestAttempts },
    };
  }

  const deadline = Date.now() + PROPAGATION_TIMEOUT_MS;
  let lastError: string | null = null;
  let lastSnapshot: { status: number; body: unknown } | null = null;
  while (Date.now() < deadline) {
    try {
      const result = await fetchQuery(endpoints.queryUrl);
      lastSnapshot = { status: result.status, body: result.body };
      if (result.status === 200 && responseReflectsIngest(result.body, probe.primaryKey)) {
        return {
          passed: true,
          message: `Round-trip OK: query at ${endpoints.queryUrl} reflects the ingested probe.`,
          details: { probe: probe.primaryKey, queryStatus: result.status, body: result.body },
        };
      }
    } catch (err) {
      lastError = (err as Error).message;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return {
    passed: false,
    message:
      `POST to ingest succeeded but ${endpoints.queryUrl} did not reflect the probe within ${PROPAGATION_TIMEOUT_MS}ms.` +
      (lastError ? ` Last error: ${lastError}` : "") +
      (lastSnapshot ? ` Last response: status=${lastSnapshot.status} body=${JSON.stringify(lastSnapshot.body).slice(0, 200)}` : ""),
    details: { probe: probe.primaryKey, lastError, lastSnapshot },
  };
}
