import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import type { AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}

export async function all_secrets_from_env_vars(): Promise<AssertionResult> {
  const WORKSPACE = "/workspace";
  const CODE_EXTENSIONS = new Set([".js", ".ts", ".py", ".go", ".rs", ".java", ".mjs", ".cjs"]);
  const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next"]);

  // Sensitive values that should never appear in source code
  const FORBIDDEN_LITERALS = [
    "decbench-taxi-jwt-secret-2024",      // JWT secret
  ];

  // Environment variable names that should be referenced via env, not hardcoded
  const ENV_VAR_NAMES = [
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
    "LANGFUSE_HOST",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "BEDROCK_GUARDRAIL_ID",
  ];

  const ENV_REFS = ["process.env", "os.environ", "getenv(", "env.get(", "Env.get("];

  const findings: Array<{ file: string; line: number; issue: string }> = [];
  let envRefsFound = 0;

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

          // Check for forbidden hardcoded secrets
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? "";
            for (const literal of FORBIDDEN_LITERALS) {
              if (line.includes(literal)) {
                findings.push({ file: path.replace(WORKSPACE + "/", ""), line: i + 1, issue: `Hardcoded secret: ${literal.substring(0, 20)}...` });
              }
            }
          }

          // Check that env var names are used with env references
          for (const envVar of ENV_VAR_NAMES) {
            if (content.includes(envVar) && ENV_REFS.some((ref) => content.includes(ref))) {
              envRefsFound++;
            }
          }
        } catch {}
      }
    } catch {}
  }

  if (existsSync(WORKSPACE)) scan(WORKSPACE);

  const noHardcodedSecrets = findings.length === 0;
  const hasEnvRefs = envRefsFound > 0;
  const passed = noHardcodedSecrets && hasEnvRefs;

  return {
    passed,
    message: passed
      ? "All secrets are read from env vars or files, none hardcoded in source."
      : noHardcodedSecrets
        ? "No hardcoded secrets found, but could not verify env var usage for service keys."
        : `Found ${findings.length} hardcoded secret(s) in source files.`,
    details: { findings, envRefsFound },
  };
}

export async function no_pii_in_source_code(): Promise<AssertionResult> {
  const WORKSPACE = "/workspace";
  const CODE_EXTENSIONS = new Set([".js", ".ts", ".py", ".go", ".rs", ".java", ".mjs", ".cjs", ".json", ".yaml", ".yml"]);
  const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next"]);

  // PII patterns from the test data that should not appear in source code
  const PII_PATTERNS = [
    /\b123-45-6789\b/,                    // SSN from test data
    /\bjohn@example\.com\b/i,             // Email from test data
    /\b555-123-4567\b/,                   // Phone from test data
    /\b987-65-4321\b/,                    // SSN from test data
  ];

  const findings: Array<{ file: string; line: number; pattern: string }> = [];

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
            const line = lines[i] ?? "";
            for (const pattern of PII_PATTERNS) {
              if (pattern.test(line)) {
                findings.push({ file: path.replace(WORKSPACE + "/", ""), line: i + 1, pattern: pattern.source });
                break;
              }
            }
          }
        } catch {}
      }
    } catch {}
  }

  if (existsSync(WORKSPACE)) scan(WORKSPACE);

  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No PII patterns from test data found in source code."
      : `Found ${findings.length} PII pattern(s) embedded in source code.`,
    details: { findings },
  };
}
