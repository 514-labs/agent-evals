import { readFileSync, existsSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}

export async function jwt_secret_read_from_file(): Promise<AssertionResult> {
  // Scan workspace code to verify the JWT secret is read from /data/auth/jwt-secret.txt
  // rather than hardcoded in source files
  const { readdirSync, statSync } = await import("node:fs");
  const { join, extname } = await import("node:path");

  const WORKSPACE = "/workspace";
  const SECRET_VALUE = "decbench-taxi-jwt-secret-2024";
  const CODE_EXTENSIONS = new Set([".js", ".ts", ".py", ".go", ".rs", ".java", ".mjs", ".cjs"]);
  const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next"]);

  const findings: Array<{ file: string; line: number }> = [];

  function scan(dir: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!IGNORED.has(entry.name)) scan(join(dir, entry.name));
          continue;
        }
        if (!CODE_EXTENSIONS.has(extname(entry.name))) continue;
        const path = join(dir, entry.name);
        try {
          if (!statSync(path).isFile() || statSync(path).size > 512_000) continue;
          const content = readFileSync(path, "utf8");
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if ((lines[i] ?? "").includes(SECRET_VALUE)) {
              findings.push({ file: path.replace(WORKSPACE + "/", ""), line: i + 1 });
            }
          }
        } catch {}
      }
    } catch {}
  }

  if (existsSync(WORKSPACE)) scan(WORKSPACE);

  return {
    passed: findings.length === 0,
    message: findings.length === 0
      ? "JWT secret is not hardcoded in source files."
      : "JWT secret value found hardcoded in source files.",
    details: { findings },
  };
}

export async function langfuse_keys_from_env_vars(): Promise<AssertionResult> {
  // Scan workspace code to verify Langfuse keys reference env vars, not hardcoded values
  const { readdirSync, statSync } = await import("node:fs");
  const { join, extname } = await import("node:path");

  const WORKSPACE = "/workspace";
  const CODE_EXTENSIONS = new Set([".js", ".ts", ".py", ".go", ".rs", ".java", ".mjs", ".cjs"]);
  const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next"]);
  const ENV_REFS = ["process.env", "os.environ", "getenv(", "env.get(", "Env.get("];
  const LANGFUSE_PATTERNS = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_HOST"];

  let foundEnvRef = false;

  function scan(dir: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!IGNORED.has(entry.name)) scan(join(dir, entry.name));
          continue;
        }
        if (!CODE_EXTENSIONS.has(extname(entry.name))) continue;
        const path = join(dir, entry.name);
        try {
          if (!statSync(path).isFile() || statSync(path).size > 512_000) continue;
          const content = readFileSync(path, "utf8");
          for (const pattern of LANGFUSE_PATTERNS) {
            if (content.includes(pattern)) {
              // Check if used with env references
              if (ENV_REFS.some((ref) => content.includes(ref))) {
                foundEnvRef = true;
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  if (existsSync(WORKSPACE)) scan(WORKSPACE);

  return {
    passed: foundEnvRef,
    message: foundEnvRef
      ? "Langfuse keys are referenced via environment variables."
      : "Could not verify Langfuse keys are read from environment variables.",
    details: { foundEnvRef },
  };
}
