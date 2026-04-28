import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { tryResolveEndpoints } from "./shared";

interface ProbeResult {
  path: string;
  status: number | string;
  ok: boolean;
}

export async function all_three_canonical_paths_respond(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) return { passed: false, message: "No deployed URL recorded.", details: {} };

  const probes: ProbeResult[] = [];

  try {
    const res = await fetch(endpoints.healthUrl);
    probes.push({ path: endpoints.healthUrl, status: res.status, ok: res.status === 200 });
  } catch (err) {
    probes.push({ path: endpoints.healthUrl, status: (err as Error).message, ok: false });
  }

  try {
    const res = await fetch(endpoints.ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        primaryKey: `robust-probe-${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        optionalText: "dec-bench robust-gate independent probe",
      }),
    });
    // Most ingest endpoints return 200 on success; some return 201/202.
    const ok = res.status >= 200 && res.status < 300;
    probes.push({ path: endpoints.ingestUrl, status: res.status, ok });
  } catch (err) {
    probes.push({ path: endpoints.ingestUrl, status: (err as Error).message, ok: false });
  }

  try {
    const res = await fetch(endpoints.queryUrl);
    probes.push({ path: endpoints.queryUrl, status: res.status, ok: res.status === 200 });
  } catch (err) {
    probes.push({ path: endpoints.queryUrl, status: (err as Error).message, ok: false });
  }

  const failures = probes.filter((p) => !p.ok);
  const passed = failures.length === 0;
  return {
    passed,
    message: passed
      ? `All three canonical paths respond (health, ingest, query).`
      : `Partial deploy detected — failing paths: ${failures.map((f) => `${f.path}=${f.status}`).join(", ")}.`,
    details: { probes },
  };
}

export async function ingest_rejects_malformed_payload(
  _ctx: AssertionContext,
): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) return { passed: false, message: "No deployed URL recorded.", details: {} };
  const ingestUrl = endpoints.ingestUrl;

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
