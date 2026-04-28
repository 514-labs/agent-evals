import { existsSync, readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const DEPLOYED_URL_FILE = "/workspace/.deployed-url";

const PROPAGATION_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;

interface BarRow {
  dayOfMonth: number;
  totalRows: number;
}

function readDeployedUrl(): string | null {
  if (!existsSync(DEPLOYED_URL_FILE)) return null;
  return readFileSync(DEPLOYED_URL_FILE, "utf8").trim() || null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchAggregate(base: string): Promise<BarRow[]> {
  const url = `${base}/api/bar`;
  const res = await fetch(url);
  if (res.status !== 200) {
    throw new Error(`/api/bar returned ${res.status}`);
  }
  const rows = (await res.json()) as BarRow[];
  if (!Array.isArray(rows)) {
    throw new Error(`/api/bar returned a non-array body: ${JSON.stringify(rows).slice(0, 200)}`);
  }
  return rows;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function ingest_lands_in_aggregate(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (!url) {
    return { passed: false, message: "No deployed URL recorded.", details: {} };
  }
  const base = trimSlash(url);

  const probe = {
    primaryKey: `bench-probe-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    optionalText: "dec-bench correct-gate round-trip probe",
  };
  const ingestUrl = `${base}/ingest/Foo`;
  let ingestStatus: number;
  let ingestBody: string;
  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(probe),
    });
    ingestStatus = res.status;
    ingestBody = (await res.text()).trim();
  } catch (err) {
    return {
      passed: false,
      message: `POST ${ingestUrl} unreachable: ${(err as Error).message}`,
      details: { stage: "ingest", error: (err as Error).message },
    };
  }
  if (ingestStatus !== 200 || ingestBody !== "SUCCESS") {
    return {
      passed: false,
      message: `POST /ingest/Foo did not accept the probe (status=${ingestStatus} body=${ingestBody.slice(0, 120)}).`,
      details: { stage: "ingest", status: ingestStatus, body: ingestBody.slice(0, 200), probe },
    };
  }

  const deadline = Date.now() + PROPAGATION_TIMEOUT_MS;
  let rows: BarRow[] = [];
  let lastError: string | null = null;
  while (Date.now() < deadline) {
    try {
      rows = await fetchAggregate(base);
      if (rows.length > 0) {
        return {
          passed: true,
          message: `Round-trip OK: /api/bar returned ${rows.length} row(s) after POST /ingest/Foo.`,
          details: { rows, probe: probe.primaryKey },
        };
      }
    } catch (err) {
      lastError = (err as Error).message;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return {
    passed: false,
    message: `POST /ingest/Foo did not land in /api/bar within ${PROPAGATION_TIMEOUT_MS}ms (response was empty).${lastError ? ` Last error: ${lastError}` : ""}`,
    details: { rows, probe: probe.primaryKey, lastError },
  };
}
