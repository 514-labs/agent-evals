import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import type { AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

const README_PATH = "/workspace/README.md";
const WORKSPACE_ROOT = "/workspace";
const TEXT_EXTS = new Set([".md", ".ts", ".tsx", ".js", ".py", ".json", ".toml", ".yaml", ".yml", ".sh"]);
const SECRET_PATTERNS: RegExp[] = [
  /HOSTING_CLI_API_KEY\s*[:=]\s*['"][^'"]+['"]/i,
  /HOSTING_CLI_ORG_ID\s*[:=]\s*['"][^'"]+['"]/i,
  /api[_-]?key\s*[:=]\s*['"][a-z0-9_\-]{20,}['"]/i,
];

export async function readme_records_deployment(): Promise<AssertionResult> {
  let content = "";
  try {
    content = readFileSync(README_PATH, "utf8");
  } catch {
    return { passed: false, message: "No /workspace/README.md.", details: {} };
  }
  const hasProjectName = /eval-bootstrap-/i.test(content);
  const hasTemplate = /typescript-express/i.test(content);
  const hasUrl = /https?:\/\/[^\s)]+\.boreal\.cloud/i.test(content);
  const passed = hasProjectName && hasTemplate && hasUrl;
  const missing = [
    !hasProjectName ? "project name" : null,
    !hasTemplate ? "template id (typescript-express)" : null,
    !hasUrl ? "deployed boreal.cloud URL" : null,
  ].filter(Boolean);
  return {
    passed,
    message: passed
      ? "README records project name, template, and deployed URL."
      : `README is missing: ${missing.join(", ")}.`,
    details: { hasProjectName, hasTemplate, hasUrl },
  };
}

export async function no_credentials_in_workspace(): Promise<AssertionResult> {
  const findings: Array<{ file: string; line: number; pattern: string }> = [];
  const visit = (dir: string, rel: string) => {
    let entries: ReturnType<typeof readdirSync> = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".git") || entry.name === "node_modules") continue;
      const abs = join(dir, entry.name);
      const next = join(rel, entry.name);
      if (entry.isDirectory()) {
        visit(abs, next);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTS.has(extname(entry.name).toLowerCase())) continue;
      try {
        if (statSync(abs).size > 256_000) continue;
        const lines = readFileSync(abs, "utf8").split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(lines[i] ?? "")) {
              findings.push({ file: next, line: i + 1, pattern: pattern.source });
            }
          }
        }
      } catch {
        // ignore
      }
    }
  };
  visit(WORKSPACE_ROOT, "");
  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No credentials found in workspace files."
      : `Found ${findings.length} potential credential leak(s) in workspace.`,
    details: { findings },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
