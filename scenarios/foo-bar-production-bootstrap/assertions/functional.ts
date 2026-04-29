import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core"
import { fetchWithWarmupRetry } from "../../_shared/assertion-helpers";
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
  let result;
  try {
    result = await fetchWithWarmupRetry(healthUrl, undefined);
  } catch (err) {
    return {
      passed: false,
      message: `${healthUrl} unreachable: ${(err as Error).message}`,
      details: { status: null, error: (err as Error).message },
    };
  }

  const { status, body, attempts } = result;
  if (status !== 200) {
    return {
      passed: false,
      message: `${healthUrl} returned ${status} after ${attempts} attempt(s): ${body.slice(0, 200)}`,
      details: { status, body: body.slice(0, 200), attempts },
    };
  }

  if (endpoints.healthCheck === "moose") {
    let parsed: { healthy?: unknown; unhealthy?: unknown };
    try {
      parsed = JSON.parse(body) as { healthy?: unknown; unhealthy?: unknown };
    } catch {
      return {
        passed: false,
        message: `${healthUrl} returned 200 but body was not JSON: ${body.slice(0, 200)}`,
        details: { status, body: body.slice(0, 200), attempts },
      };
    }
    const healthy = Array.isArray(parsed.healthy) ? (parsed.healthy as string[]) : [];
    const unhealthy = Array.isArray(parsed.unhealthy) ? (parsed.unhealthy as string[]) : [];
    const missing = REQUIRED_HEALTHY_COMPONENTS_MOOSE.filter((c) => !healthy.includes(c));
    const passed = unhealthy.length === 0 && missing.length === 0;
    return {
      passed,
      message: passed
        ? `Runtime healthy. Components: ${healthy.join(", ")}`
        : `Runtime not healthy. unhealthy=[${unhealthy.join(",")}] missing-required=[${missing.join(",")}]`,
      details: { healthy, unhealthy, missing, mode: "moose", attempts },
    };
  }

  return {
    passed: true,
    message: `Health endpoint at ${healthUrl} responded 200.`,
    details: { status, mode: "http-200", attempts },
  };
}
