// Shared endpoint resolver for foo-bar-production-bootstrap assertions.
//
// The scenario runs across multiple harnesses (olap-for-swe, base-rt, ...).
// Each harness publishes its endpoint contract via env vars in env.sh, and
// agents on harnesses that don't have a pinned template can override the
// paths by writing /workspace/.endpoints.json.
//
// Resolution order:
//   1. EVAL_INGEST_PATH / EVAL_QUERY_PATH / EVAL_HEALTH_PATH from env.sh
//   2. /workspace/.endpoints.json (if present) overrides any of those paths
//
// The deployed base URL itself comes from /workspace/.deployed-url (written
// by the agent).

import { existsSync, readFileSync } from "node:fs";

const DEFAULT_DEPLOYED_URL_FILE = "/workspace/.deployed-url";
const DEFAULT_ENDPOINTS_FILE = "/workspace/.endpoints.json";

type HealthCheckMode = "moose" | "http-200";

export interface ResolvedEndpoints {
  base: string;
  ingestUrl: string;
  queryUrl: string;
  healthUrl: string;
  healthCheck: HealthCheckMode;
  productionUrlPattern: RegExp;
  readmeTemplateRequired: boolean;
  deployTemplate: string | null;
}

interface EndpointOverlay {
  ingest?: string;
  query?: string;
  health?: string;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinPath(base: string, path: string): string {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${trimSlash(base)}${normalized}`;
}

function readDeployedUrlFromFile(): string | null {
  const file = process.env.DEPLOYED_URL_FILE || DEFAULT_DEPLOYED_URL_FILE;
  if (!existsSync(file)) return null;
  const url = readFileSync(file, "utf8").trim();
  return url.length > 0 ? url : null;
}

function readEndpointOverlay(): EndpointOverlay {
  const file = process.env.ENDPOINTS_FILE || DEFAULT_ENDPOINTS_FILE;
  if (!existsSync(file)) return {};
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  if (raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw) as EndpointOverlay;
    return {
      ingest: typeof parsed.ingest === "string" ? parsed.ingest : undefined,
      query: typeof parsed.query === "string" ? parsed.query : undefined,
      health: typeof parsed.health === "string" ? parsed.health : undefined,
    };
  } catch {
    return {};
  }
}

function parsePattern(raw: string | undefined, fallback: RegExp): RegExp {
  if (!raw) return fallback;
  try {
    return new RegExp(raw, "i");
  } catch {
    return fallback;
  }
}

/**
 * Resolve the deployed base URL + endpoint paths. Returns null when the
 * agent never wrote .deployed-url; assertions short-circuit in that case.
 */
export function readDeployedUrl(): string | null {
  return readDeployedUrlFromFile();
}

/**
 * Resolve full URLs for ingest/query/health, plus the harness-declared URL
 * pattern and health-check mode. Throws if no deployed URL recorded.
 */
export function resolveEndpoints(): ResolvedEndpoints {
  const base = readDeployedUrlFromFile();
  if (!base) {
    throw new Error("No deployed URL recorded.");
  }
  const overlay = readEndpointOverlay();

  const ingest = overlay.ingest ?? process.env.EVAL_INGEST_PATH ?? "/ingest/Foo";
  const query = overlay.query ?? process.env.EVAL_QUERY_PATH ?? "/api/bar";
  const health = overlay.health ?? process.env.EVAL_HEALTH_PATH ?? "/health";

  const healthCheckRaw = (process.env.EVAL_HEALTH_CHECK ?? "http-200").toLowerCase();
  const healthCheck: HealthCheckMode = healthCheckRaw === "moose" ? "moose" : "http-200";

  const productionUrlPattern = parsePattern(
    process.env.EVAL_PRODUCTION_URL_PATTERN,
    /^https:\/\/[a-z0-9.-]+(\/|$)/i,
  );

  const readmeTemplateRequired = (process.env.EVAL_README_TEMPLATE_REQUIRED ?? "0") === "1";
  const deployTemplate = process.env.DEPLOY_TEMPLATE?.trim() || null;

  return {
    base: trimSlash(base),
    ingestUrl: joinPath(base, ingest),
    queryUrl: joinPath(base, query),
    healthUrl: joinPath(base, health),
    healthCheck,
    productionUrlPattern,
    readmeTemplateRequired,
    deployTemplate,
  };
}

/**
 * Like resolveEndpoints but doesn't throw when there's no deployed URL —
 * useful for assertions that need to report `passed: false` rather than
 * crash. Returns null if the agent never wrote .deployed-url.
 */
export function tryResolveEndpoints(): ResolvedEndpoints | null {
  if (!readDeployedUrlFromFile()) return null;
  return resolveEndpoints();
}
