import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

const WORKSPACE_ROOT = "/workspace";
const SECRET_LITERALS = [
  "decbench-access-key",
  "decbench-secret-key",
  "decbench-session-token",
];
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".sql",
  ".sh",
  ".json",
  ".toml",
  ".yaml",
  ".yml",
  ".md",
]);

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({
    query: sql,
    format: "JSONEachRow",
  });
  return (await (result as any).json()) as T[];
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function no_hardcoded_s3_secret_values(): Promise<AssertionResult> {
  const findings: Array<{ file: string; line: number; literal: string }> = [];

  for (const file of collectWorkspaceTextFiles()) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const literal = SECRET_LITERALS.find((candidate) =>
        line.includes(candidate),
      );
      if (!literal) {
        continue;
      }
      findings.push({ file: file.relativePath, line: index + 1, literal });
      if (findings.length >= 10) {
        break;
      }
    }
  }

  return {
    passed: findings.length === 0,
    message:
      findings.length === 0
        ? "Workspace does not hardcode seeded S3 secret values."
        : "Workspace hardcodes seeded S3 secret values instead of reading environment variables.",
    details: { findings },
  };
}

export async function no_leftover_tmp_tables(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') AND (name LIKE '%tmp%' OR name LIKE '%scratch%')",
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 0,
    message:
      count === 0
        ? "No leftover temporary ClickHouse tables."
        : `Found ${count} leftover tmp/scratch tables.`,
    details: { count },
  };
}

function collectWorkspaceTextFiles(): Array<{
  relativePath: string;
  content: string;
}> {
  const files: Array<{ relativePath: string; content: string }> = [];

  function visit(current: string, relativePrefix = "") {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          visit(join(current, entry.name), join(relativePrefix, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (
        !TEXT_EXTENSIONS.has(extension) &&
        basename(entry.name).toLowerCase() !== "dockerfile"
      ) {
        continue;
      }

      const absolutePath = join(current, entry.name);
      try {
        const stat = statSync(absolutePath);
        if (stat.size <= 512_000) {
          files.push({
            relativePath: join(relativePrefix, entry.name),
            content: readFileSync(absolutePath, "utf8"),
          });
        }
      } catch {
        // Ignore files that disappear or cannot be read while scanning.
      }
    }
  }

  try {
    if (statSync(WORKSPACE_ROOT).isDirectory()) {
      visit(WORKSPACE_ROOT);
    }
  } catch {
    return files;
  }

  return files;
}
