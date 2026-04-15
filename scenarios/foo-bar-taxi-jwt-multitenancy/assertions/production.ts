import { readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function jwt_secret_not_hardcoded(): Promise<AssertionResult> {
  // Check that the JWT secret value does not appear literally in source files
  const { readdirSync, statSync } = await import("node:fs");
  const { join, extname } = await import("node:path");

  const secret = readFileSync("/data/auth/jwt-secret.txt", "utf8").trim();
  const findings: Array<{ file: string; line: number }> = [];

  const IGNORED = new Set([".git", "node_modules", "dist", "build", "__pycache__", ".venv"]);
  const TEXT_EXTS = new Set([".ts", ".js", ".py", ".go", ".rs", ".java", ".json", ".yaml", ".yml", ".toml", ".sh", ".md"]);

  function visit(dir: string, rel: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED.has(entry.name)) continue;
        visit(join(dir, entry.name), join(rel, entry.name));
      } else if (entry.isFile() && TEXT_EXTS.has(extname(entry.name).toLowerCase())) {
        try {
          const stat = statSync(join(dir, entry.name));
          if (stat.size > 512_000) continue;
          const content = readFileSync(join(dir, entry.name), "utf8");
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i]!.includes(secret)) {
              findings.push({ file: join(rel, entry.name), line: i + 1 });
            }
          }
        } catch {}
      }
    }
  }

  try {
    visit("/workspace", "");
  } catch {}

  return {
    passed: findings.length === 0,
    message: findings.length === 0
      ? "JWT secret is not hardcoded in workspace source files."
      : "JWT secret value found hardcoded in workspace source files.",
    details: { findings },
  };
}
