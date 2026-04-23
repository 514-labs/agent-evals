import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import {
  IGNORED_SCAN_DIRS,
  IGNORED_SCAN_FILENAMES,
  type AssertionContext,
  type AssertionResult,
} from "@dec-bench/eval-core";

const WORKSPACE_ROOT = "/workspace";
const TEXT_FILE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".md",
]);
// Filenames that count as a top-level operator-facing doc.
const README_FILENAMES = new Set(["readme.md", "readme.txt"]);
// Directory names that count as an operator-facing docs location.
const DOCS_DIR_NAMES = new Set(["docs", "doc"]);
const DEFAULT_CONNECTION_LITERALS = [
  "localhost:5432",
  "localhost:8123",
  "localhost:9000",
  "localhost:9092",
  "localhost:7181",
  "localhost:7182",
];
const DEFAULT_ENV_TOKENS = [
  "process.env",
  "ctx.env(",
  "os.environ",
  "getenv(",
  "POSTGRES_URL",
  "CLICKHOUSE_URL",
  "REDPANDA_BROKER",
];

interface WorkspaceTextFile {
  path: string;
  relativePath: string;
  content: string;
}

export async function scanWorkspaceForHardcodedConnections(options?: {
  literals?: string[];
  envTokens?: string[];
}): Promise<AssertionResult> {
  const literals = options?.literals ?? DEFAULT_CONNECTION_LITERALS;
  const envTokens = options?.envTokens ?? DEFAULT_ENV_TOKENS;
  const findings: Array<{ file: string; line: number; literal: string }> = [];

  for (const file of collectWorkspaceTextFiles()) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!literals.some((literal) => line.includes(literal))) {
        continue;
      }
      if (envTokens.some((token) => line.includes(token))) {
        continue;
      }
      findings.push({
        file: file.relativePath,
        line: index + 1,
        literal: literals.find((literal) => line.includes(literal)) ?? "unknown",
      });
      if (findings.length >= 10) {
        break;
      }
    }
  }

  return {
    passed: findings.length === 0,
    message:
      findings.length === 0
        ? "No hardcoded connection strings found in workspace files."
        : "Hardcoded connection strings found in workspace files.",
    details: {
      findings,
    },
  };
}

export async function hasReadmeOrDocs(): Promise<AssertionResult> {
  // Walk the workspace looking for README.{md,txt} at any depth, or any
  // file nested under a `docs/`/`doc/` directory. Matches how multi-package
  // harnesses (Moose, etc.) commonly place their README in a subdirectory
  // rather than at the workspace root.
  const foundPaths = new Set<string>();
  for (const file of collectWorkspaceTextFiles()) {
    const name = basename(file.relativePath).toLowerCase();
    if (README_FILENAMES.has(name)) {
      foundPaths.add(file.relativePath);
      continue;
    }
    const segments = file.relativePath.split("/");
    if (segments.some((segment) => DOCS_DIR_NAMES.has(segment.toLowerCase()))) {
      const docsSegmentIndex = segments.findIndex((segment) =>
        DOCS_DIR_NAMES.has(segment.toLowerCase()),
      );
      foundPaths.add(segments.slice(0, docsSegmentIndex + 1).join("/"));
    }
  }
  const paths = Array.from(foundPaths);
  return {
    passed: paths.length > 0,
    message:
      paths.length > 0
        ? "Workspace includes operator-facing docs or a README."
        : "Workspace is missing a README or docs directory for operator handoff.",
    details: {
      foundPaths: paths,
    },
  };
}

export async function avoidsSelectStarQueries(options?: {
  excludePaths?: RegExp[];
}): Promise<AssertionResult> {
  const excludePaths = options?.excludePaths ?? [];
  const findings: Array<{ file: string; line: number }> = [];
  for (const file of collectWorkspaceTextFiles()) {
    if (excludePaths.some((pattern) => pattern.test(file.relativePath))) {
      continue;
    }
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!/\bselect\s+\*/i.test(line)) {
        continue;
      }
      findings.push({
        file: file.relativePath,
        line: index + 1,
      });
      if (findings.length >= 10) {
        break;
      }
    }
  }

  return {
    passed: findings.length === 0,
    message:
      findings.length === 0
        ? "Workspace avoids `SELECT *` queries in checked source files."
        : "Workspace still contains `SELECT *` queries in checked source files.",
    details: {
      findings,
    },
  };
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

const SYSTEM_DATABASES = ["system", "INFORMATION_SCHEMA", "information_schema"];

export interface TableRef {
  database: string;
  table: string;
  engine?: string;
  total_rows?: number;
}

/** Normalize a table/column name for comparison: lowercase + strip underscores. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/_/g, "");
}

/**
 * Find tables in ClickHouse by fuzzy-matching against one or more concept terms.
 *
 * Concepts are matched against the table name after normalization (lowercase +
 * underscore-stripped), so "user_activity", "UserActivity", and "useractivity"
 * all match the concept "user_activity".
 *
 * Results are ranked:
 *  1. Tables containing ALL concepts score higher than partial matches.
 *  2. Shorter table names rank before longer ones (closer to the core concept).
 *  3. Non-MV targets (.inner_id.*) are de-ranked.
 *
 * @example
 *   findTables(ctx, { concepts: ["user", "activity"] })
 *   findTables(ctx, { concepts: ["product", "event"], engines: ["MergeTree"] })
 *   findTables(ctx, { concepts: ["top", "product"], excludeInternal: true })
 */
export async function findTables(
  ctx: AssertionContext,
  options: {
    concepts: string[];
    engines?: string[];
    excludeInternal?: boolean;
    database?: string;
  },
): Promise<TableRef[]> {
  const whereClauses: string[] = [
    `database NOT IN (${SYSTEM_DATABASES.map((d) => `'${d}'`).join(",")})`,
  ];
  if (options.database) {
    whereClauses.push(`database = '${options.database}'`);
  }
  if (options.excludeInternal !== false) {
    // ClickHouse internal MV storage tables look like `.inner_id.<uuid>`
    whereClauses.push(`name NOT LIKE '.inner%'`);
  }

  const rows = await queryRows<{ database: string; name: string; engine: string; total_rows: number | null }>(
    ctx,
    `SELECT database, name, engine, total_rows
     FROM system.tables
     WHERE ${whereClauses.join(" AND ")}`,
  );

  // Normalize concepts and rank each table
  const normalizedConcepts = options.concepts.map(normalize);
  const scored = rows
    .map((row) => {
      const norm = normalize(row.name);
      const matchedConcepts = normalizedConcepts.filter((c) => norm.includes(c));
      if (matchedConcepts.length === 0) return null;
      if (options.engines && options.engines.length > 0) {
        const engineOk = options.engines.some((e) => row.engine.includes(e));
        if (!engineOk) return null;
      }
      // Score: full concept match bonus + shorter name bonus
      const conceptScore = matchedConcepts.length / normalizedConcepts.length;
      const lengthPenalty = row.name.length / 100; // longer names score slightly lower
      const score = conceptScore - lengthPenalty;
      return {
        ref: {
          database: row.database,
          table: row.name,
          engine: row.engine,
          total_rows: row.total_rows ?? undefined,
        } as TableRef,
        score,
      };
    })
    .filter((x): x is { ref: TableRef; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.ref);
}

/** Find the single best table match, or null. */
export async function findTable(
  ctx: AssertionContext,
  options: Parameters<typeof findTables>[1],
): Promise<TableRef | null> {
  const matches = await findTables(ctx, options);
  return matches.length > 0 ? matches[0] : null;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

/**
 * List columns of a table via `DESCRIBE TABLE`.
 *
 * Why DESCRIBE, not `system.columns`: Tinybird (and some CH view setups)
 * expose friendly data-source names as views over internal storage tables.
 * Those views respond to `SELECT * FROM view` but don't always populate
 * `system.columns` rows — `system.columns` only sees the physical backing
 * table under a hashed name. `DESCRIBE TABLE name` resolves through the
 * view and returns the projected column list, which works uniformly for
 * physical tables, materialized views, and view layers.
 *
 * Returns [] (not throws) when the table can't be described — this matches
 * the legacy `system.columns`-returning-zero-rows behavior so assertions
 * that expected an empty list on misses keep their semantics.
 */
export async function describeTable(
  ctx: AssertionContext,
  database: string,
  table: string,
): Promise<ColumnInfo[]> {
  try {
    const rows = await queryRows<{ name: string; type: string }>(
      ctx,
      `DESCRIBE TABLE \`${database}\`.\`${table}\``,
    );
    return rows.map((r) => ({ name: r.name, type: r.type }));
  } catch {
    return [];
  }
}

/** Convenience: case-insensitive existence check by column name. */
export async function hasColumn(
  ctx: AssertionContext,
  database: string,
  table: string,
  ...names: string[]
): Promise<boolean> {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const cols = await describeTable(ctx, database, table);
  return cols.some((c) => wanted.has(c.name.toLowerCase()));
}

/**
 * Find a column whose name matches one of the candidates (fuzzy: case-insensitive,
 * underscore-insensitive). Returns the actual column name (preserving case) or null.
 *
 * @example
 *   resolveColumn(ctx, "analytics", "events", "event_id", "eventId")
 *   resolveColumn(ctx, db, table, "duration_ms", "durationMs", "duration")
 */
export async function resolveColumn(
  ctx: AssertionContext,
  database: string,
  table: string,
  ...candidates: string[]
): Promise<string | null> {
  const normalizedCandidates = candidates.map(normalize);
  const cols = await describeTable(ctx, database, table);
  for (const col of cols) {
    if (normalizedCandidates.includes(normalize(col.name))) {
      return col.name;
    }
  }
  return null;
}

// --- Domain-specific wrappers (back-compat + convenience) ---

/**
 * Find a user_activity table across all non-system databases.
 * Matches user_activity, UserActivity, UserActivityEvent, etc.
 */
export async function findUserActivityTable(ctx: AssertionContext): Promise<TableRef | null> {
  return findTable(ctx, { concepts: ["user", "activity"] });
}

/** Find an events table across all non-system databases. */
export async function findEventsTable(ctx: AssertionContext): Promise<TableRef | null> {
  return findTable(ctx, { concepts: ["event"] });
}

/** Find a product_events table (product + event). */
export async function findProductEventsTable(ctx: AssertionContext): Promise<TableRef | null> {
  return findTable(ctx, { concepts: ["product", "event"] });
}

// --- API probing (port-flexible) ---

export interface ApiProbeResult {
  url: string;
  response: Response;
}

export interface ApiProbeOptions {
  /** Fallback request paths (used when env var is not set). Prepended with `http://localhost:<port>`. */
  paths?: string[];
  /** Fallback ports to scan when env var is not set. Default [3000, 4000, 8080]. */
  ports?: number[];
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Try a single URL with timeout. Returns the result on any non-5xx status, null on network error.
 * Callers that require `response.ok` should check it on the returned response.
 */
async function tryUrl(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<ApiProbeResult | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(init.timeoutMs ?? 3000),
    });
    // Accept anything under 500 as "responded"; caller filters further.
    if (response.status < 500) {
      return { url, response };
    }
  } catch {
    // fall through
  }
  return null;
}

function buildHeaders(
  baseHeaders: Record<string, string> | undefined,
  authEnvVar: string | undefined,
  ctx: AssertionContext,
): Record<string, string> {
  const headers = { ...(baseHeaders ?? {}) };
  if (authEnvVar) {
    const auth = ctx.env(authEnvVar);
    if (auth && !headers.Authorization && !headers.authorization) {
      headers.Authorization = auth;
    }
  }
  return headers;
}

async function probeApi(
  ctx: AssertionContext,
  envVar: string,
  authEnvVar: string,
  fallbackUrls: string[],
  options: ApiProbeOptions,
): Promise<ApiProbeResult | null> {
  const headers = buildHeaders(options.headers, authEnvVar, ctx);
  const init: RequestInit & { timeoutMs?: number } = {
    method: options.method ?? "GET",
    body: options.body ?? null,
    headers,
    timeoutMs: options.timeoutMs,
  };

  // Env-var override takes priority. No port-scan if env is set — the
  // harness is telling us exactly where the endpoint lives.
  const explicit = ctx.env(envVar);
  if (explicit) {
    return tryUrl(explicit, init);
  }

  // Fallback: legacy port × path scan. Preserves base-rt / olap-for-swe
  // behavior where agents typically pick :3000.
  for (const url of fallbackUrls) {
    const result = await tryUrl(url, init);
    if (result) return result;
  }
  return null;
}

/**
 * Probe an egress (read) API endpoint. Env-first, then port-scan fallback.
 *
 * Env vars:
 *   EGRESS_URL_<NAME_UPPER_SNAKE>   e.g. `top-products` → `EGRESS_URL_TOP_PRODUCTS`
 *   EGRESS_AUTH_HEADER              optional, sent as `Authorization: <value>`
 *
 * Fallback (when env var is unset): scans `http://localhost:<port><path>` for
 * each combination of `options.ports ?? [3000, 4000, 8080]` and
 * `options.paths ?? ['/api/<name>']`.
 */
export async function probeEgress(
  ctx: AssertionContext,
  name: string,
  options?: ApiProbeOptions,
): Promise<ApiProbeResult | null> {
  const envVar = `EGRESS_URL_${name.toUpperCase().replace(/-/g, "_")}`;
  const paths = options?.paths ?? [`/api/${name}`];
  const ports = options?.ports ?? [3000, 4000, 8080];
  const fallbacks = ports.flatMap((p) =>
    paths.map((pa) => `http://localhost:${p}${pa.startsWith("/") ? pa : `/${pa}`}`),
  );
  return probeApi(ctx, envVar, "EGRESS_AUTH_HEADER", fallbacks, options ?? {});
}

/**
 * Probe an ingest (write) API endpoint. Env-first, then port-scan fallback.
 *
 * Env vars:
 *   INGEST_URL          full URL including any query params
 *   INGEST_AUTH_HEADER  optional
 *
 * Default method is POST with `Content-Type: application/json`.
 */
export async function probeIngest(
  ctx: AssertionContext,
  options?: ApiProbeOptions,
): Promise<ApiProbeResult | null> {
  const paths = options?.paths ?? ["/ingest/events", "/ingest", "/events"];
  const ports = options?.ports ?? [3000, 4000, 8080];
  const fallbacks = ports.flatMap((p) =>
    paths.map((pa) => `http://localhost:${p}${pa.startsWith("/") ? pa : `/${pa}`}`),
  );
  const opts: ApiProbeOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  return probeApi(ctx, "INGEST_URL", "INGEST_AUTH_HEADER", fallbacks, opts);
}

/**
 * Convenience: probe an egress endpoint and parse a JSON body. Returns
 * `{ url, data }` on HTTP 2xx with valid JSON; otherwise null.
 *
 * Automatically unwraps Tinybird-style pipe responses. Tinybird pipes
 * return `{"meta": [...], "data": [...], "rows": N, "statistics": {...}}`
 * — assertions that expect a bare array (as Moose/base-rt agents return)
 * would fail on `Array.isArray(body)` unless we unwrap. Any response
 * object with both `meta` and array-typed `data` is treated as a
 * Tinybird envelope and its `data` field returned instead.
 */
export async function fetchEgressJson<T = unknown>(
  ctx: AssertionContext,
  name: string,
  options?: ApiProbeOptions,
): Promise<{ url: string; data: T } | null> {
  const result = await probeEgress(ctx, name, options);
  if (!result || !result.response.ok) return null;
  try {
    const raw = await result.response.json();
    const data = unwrapTinybirdEnvelope(raw) as T;
    return { url: result.url, data };
  } catch {
    return null;
  }
}

function unwrapTinybirdEnvelope(body: unknown): unknown {
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "data" in body &&
    "meta" in body &&
    Array.isArray((body as { data: unknown }).data)
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

function collectWorkspaceTextFiles(): WorkspaceTextFile[] {
  const files: WorkspaceTextFile[] = [];
  const visit = (current: string, relativePrefix = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_SCAN_DIRS.has(entry.name)) {
          continue;
        }
        visit(join(current, entry.name), join(relativePrefix, entry.name));
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (IGNORED_SCAN_FILENAMES.has(entry.name)) {
        continue;
      }
      const extension = extname(entry.name).toLowerCase();
      if (!TEXT_FILE_EXTENSIONS.has(extension) && basename(entry.name).toLowerCase() !== "dockerfile") {
        continue;
      }

      const absolutePath = join(current, entry.name);
      if (!isReadableTextFile(absolutePath)) {
        continue;
      }
      files.push({
        path: absolutePath,
        relativePath: join(relativePrefix, entry.name),
        content: readFileSync(absolutePath, "utf8"),
      });
    }
  };

  if (exists(WORKSPACE_ROOT)) {
    visit(WORKSPACE_ROOT);
  }
  return files;
}

function exists(path: string): boolean {
  try {
    return statSync(path).isFile() || statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isReadableTextFile(path: string): boolean {
  try {
    const stat = statSync(path);
    return stat.isFile() && stat.size <= 512_000;
  } catch {
    return false;
  }
}
