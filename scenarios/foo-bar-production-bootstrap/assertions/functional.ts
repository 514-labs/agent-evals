import { existsSync, readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const DEPLOYED_URL_FILE = "/workspace/.deployed-url";

// Real Boreal deploys live at https://<project>.boreal.cloud. Anything else
// (localhost, raw IPs, http://, tunnels, *.vercel.app, etc.) is a mock or a
// dev tunnel and shouldn't pass the gate.
const PRODUCTION_URL_PATTERN = /^https:\/\/[a-z0-9][a-z0-9.-]*\.boreal\.cloud(\/|$)/i;

const REQUIRED_HEALTHY_COMPONENTS = [
  "ClickHouse",
  "Redpanda",
  "Consumption API",
];

function readDeployedUrl(): string | null {
  if (!existsSync(DEPLOYED_URL_FILE)) return null;
  const url = readFileSync(DEPLOYED_URL_FILE, "utf8").trim();
  return url.length > 0 ? url : null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function deployed_url_recorded(_ctx: AssertionContext): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (url === null) {
    return {
      passed: false,
      message: `Agent did not write a URL to ${DEPLOYED_URL_FILE}.`,
      details: { url: null },
    };
  }
  const passed = PRODUCTION_URL_PATTERN.test(url);
  return {
    passed,
    message: passed
      ? `Agent recorded deployed URL: ${url}`
      : `Recorded URL is not a Boreal production URL: ${url}. ` +
        `Expected https://<project>.boreal.cloud — local stubs and dev tunnels do not satisfy the production bootstrap gate.`,
    details: { url, expectedPattern: PRODUCTION_URL_PATTERN.source },
  };
}

export async function runtime_is_healthy(_ctx: AssertionContext): Promise<AssertionResult> {
  const url = readDeployedUrl();
  if (!url) {
    return { passed: false, message: "No deployed URL recorded.", details: {} };
  }
  const healthUrl = `${trimSlash(url)}/health`;
  let status: number | null = null;
  try {
    const res = await fetch(healthUrl);
    status = res.status;
    if (res.status !== 200) {
      const text = await res.text();
      return {
        passed: false,
        message: `${healthUrl} returned ${res.status}: ${text.slice(0, 200)}`,
        details: { status, body: text.slice(0, 200) },
      };
    }
    const body = (await res.json()) as { healthy?: unknown; unhealthy?: unknown };
    const healthy = Array.isArray(body.healthy) ? (body.healthy as string[]) : [];
    const unhealthy = Array.isArray(body.unhealthy) ? (body.unhealthy as string[]) : [];
    const missing = REQUIRED_HEALTHY_COMPONENTS.filter((c) => !healthy.includes(c));
    const passed = unhealthy.length === 0 && missing.length === 0;
    return {
      passed,
      message: passed
        ? `Runtime healthy. Components: ${healthy.join(", ")}`
        : `Runtime not healthy. unhealthy=[${unhealthy.join(",")}] missing-required=[${missing.join(",")}]`,
      details: { healthy, unhealthy, missing },
    };
  } catch (err) {
    return {
      passed: false,
      message: `${healthUrl} unreachable: ${(err as Error).message}`,
      details: { status, error: (err as Error).message },
    };
  }
}
