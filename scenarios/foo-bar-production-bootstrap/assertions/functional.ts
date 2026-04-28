import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readDeployedUrl, tryResolveEndpoints } from "./shared";

const REQUIRED_HEALTHY_COMPONENTS_MOOSE = [
  "ClickHouse",
  "Redpanda",
  "Consumption API",
];

export async function deployed_url_recorded(_ctx: AssertionContext): Promise<AssertionResult> {
  const url = readDeployedUrl();
  const endpoints = tryResolveEndpoints();
  if (url === null || endpoints === null) {
    return {
      passed: false,
      message: `Agent did not write a URL to ${process.env.DEPLOYED_URL_FILE ?? "/workspace/.deployed-url"}.`,
      details: { url: null },
    };
  }
  const passed = endpoints.productionUrlPattern.test(url);
  return {
    passed,
    message: passed
      ? `Agent recorded deployed URL: ${url}`
      : `Recorded URL is not a production URL: ${url}. ` +
        `Expected match against ${endpoints.productionUrlPattern.source} — local stubs and dev tunnels do not satisfy the production bootstrap gate.`,
    details: { url, expectedPattern: endpoints.productionUrlPattern.source },
  };
}

export async function runtime_is_healthy(_ctx: AssertionContext): Promise<AssertionResult> {
  const endpoints = tryResolveEndpoints();
  if (!endpoints) {
    return { passed: false, message: "No deployed URL recorded.", details: {} };
  }
  const healthUrl = endpoints.healthUrl;
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

    if (endpoints.healthCheck === "moose") {
      const body = (await res.json()) as { healthy?: unknown; unhealthy?: unknown };
      const healthy = Array.isArray(body.healthy) ? (body.healthy as string[]) : [];
      const unhealthy = Array.isArray(body.unhealthy) ? (body.unhealthy as string[]) : [];
      const missing = REQUIRED_HEALTHY_COMPONENTS_MOOSE.filter((c) => !healthy.includes(c));
      const passed = unhealthy.length === 0 && missing.length === 0;
      return {
        passed,
        message: passed
          ? `Runtime healthy. Components: ${healthy.join(", ")}`
          : `Runtime not healthy. unhealthy=[${unhealthy.join(",")}] missing-required=[${missing.join(",")}]`,
        details: { healthy, unhealthy, missing, mode: "moose" },
      };
    }

    return {
      passed: true,
      message: `Health endpoint at ${healthUrl} responded 200.`,
      details: { status, mode: "http-200" },
    };
  } catch (err) {
    return {
      passed: false,
      message: `${healthUrl} unreachable: ${(err as Error).message}`,
      details: { status, error: (err as Error).message },
    };
  }
}
