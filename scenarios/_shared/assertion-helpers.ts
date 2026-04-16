import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const WORKSPACE_ROOT = "/workspace";
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
]);
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
const DOC_PATHS = [
  join(WORKSPACE_ROOT, "README.md"),
  join(WORKSPACE_ROOT, "README.txt"),
  join(WORKSPACE_ROOT, "docs"),
];
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
  const foundPaths = DOC_PATHS.filter((path) => exists(path));
  return {
    passed: foundPaths.length > 0,
    message:
      foundPaths.length > 0
        ? "Workspace includes operator-facing docs or a README."
        : "Workspace is missing a README or docs directory for operator handoff.",
    details: {
      foundPaths,
    },
  };
}

export async function avoidsSelectStarQueries(): Promise<AssertionResult> {
  const findings: Array<{ file: string; line: number }> = [];
  for (const file of collectWorkspaceTextFiles()) {
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

/**
 * Find a user_activity table across all non-system databases.
 * Matches snake_case (user_activity), PascalCase (UserActivity, UserActivityEvent),
 * and other naming conventions to support both raw ClickHouse and Moose-created tables.
 */
export async function findUserActivityTable(
  ctx: AssertionContext,
): Promise<{ database: string; table: string } | null> {
  const rows = await queryRows<{ database: string; name: string }>(
    ctx,
    `SELECT database, name FROM system.tables
     WHERE (lower(name) LIKE '%user_activity%' OR lower(name) LIKE '%useractivity%')
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
     ORDER BY length(name) ASC`,
  );
  return rows.length > 0 ? { database: rows[0].database, table: rows[0].name } : null;
}

function collectWorkspaceTextFiles(): WorkspaceTextFile[] {
  const files: WorkspaceTextFile[] = [];
  const visit = (current: string, relativePrefix = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        visit(join(current, entry.name), join(relativePrefix, entry.name));
        continue;
      }
      if (!entry.isFile()) {
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
