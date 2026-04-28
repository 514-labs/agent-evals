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
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.columns WHERE database = '${database}' AND table = '${table}'`,
  );
  for (const row of rows) {
    if (normalizedCandidates.includes(normalize(row.name))) {
      return row.name;
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
