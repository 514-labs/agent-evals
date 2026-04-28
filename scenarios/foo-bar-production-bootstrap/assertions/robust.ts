import { existsSync, readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const DEPLOYED_URL_FILE = "/workspace/.deployed-url";

function readDeployedUrl(): string | null {
  if (!existsSync(DEPLOYED_URL_FILE)) return null;
  return readFileSync(DEPLOYED_URL_FILE, "utf8").trim() || null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

interface ProbeResult {
  path: string;
  status: number | string;
  ok: boolean;
}

export async function all_three_canonical_paths_respond(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (!url) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const base = trimSlash(url);

  const probes: ProbeResult[] = [];

  try {
    const res = await fetch(`${base}/health`);
    probes.push({ path: "/health", status: res.status, ok: res.status === 200 });
  } catch (err) {
    probes.push({ path: "/health", status: (err as Error).message, ok: false });
  }

  try {
    const res = await fetch(`${base}/ingest/Foo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        primaryKey: `robust-probe-${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        optionalText: "dec-bench robust-gate independent probe",
      }),
    });
    probes.push({ path: "/ingest/Foo", status: res.status, ok: res.status === 200 });
  } catch (err) {
    probes.push({ path: "/ingest/Foo", status: (err as Error).message, ok: false });
  }

  try {
    const res = await fetch(`${base}/api/bar?orderBy=totalRows&startDay=1&endDay=31&limit=1`);
    probes.push({ path: "/api/bar", status: res.status, ok: res.status === 200 });
  } catch (err) {
    probes.push({ path: "/api/bar", status: (err as Error).message, ok: false });
  }

  const failures = probes.filter((p) => !p.ok);
  const passed = failures.length === 0;
  return {
    passed,
    message: passed
      ? `All three canonical paths respond (/health, /ingest/Foo, /api/bar).`
      : `Partial deploy detected — failing paths: ${failures.map((f) => `${f.path}=${f.status}`).join(", ")}.`,
    details: { probes },
  };
}

export async function ingest_rejects_malformed_payload(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (!url) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const ingestUrl = `${trimSlash(url)}/ingest/Foo`;

  // Missing required `primaryKey` field, wrong type for `timestamp`.
  const malformed = { timestamp: "not-a-number", optionalText: "garbage" };
  let status: number;
  let body: string;
  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(malformed),
    });
    status = res.status;
    body = (await res.text()).slice(0, 200);
  } catch (err) {
    return {
      passed: false,
      message: `${ingestUrl} unreachable while sending malformed payload: ${(err as Error).message}.`,
      details: { error: (err as Error).message },
    };
  }
  const passed = status >= 400 && status < 500;
  return {
    passed,
    message: passed
      ? `Malformed payload correctly rejected with ${status}.`
      : status >= 500
        ? `Malformed payload caused a ${status} — runtime crashes on bad input instead of rejecting cleanly.`
        : `Malformed payload was accepted with ${status} — validation is missing.`,
    details: { status, body },
  };
}
