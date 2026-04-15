import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import type { AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function api_keys_from_env(): Promise<AssertionResult> {
  // Check that API keys (e.g., OpenAI, Anthropic) are loaded from environment variables, not hardcoded
  const IGNORED = new Set([".git", "node_modules", "dist", "build", "__pycache__", ".venv"]);
  const TEXT_EXTS = new Set([".ts", ".js", ".py", ".go", ".rs", ".java", ".json", ".yaml", ".yml", ".toml", ".sh"]);
  const API_KEY_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/,  // OpenAI-style keys
    /sk-ant-[a-zA-Z0-9]{20,}/,  // Anthropic-style keys
    /["'](?:openai|anthropic|OPENAI|ANTHROPIC)_?(?:API_?)?KEY["']\s*[:=]\s*["'][^"']{10,}["']/,
  ];
  const ENV_TOKENS = ["process.env", "os.environ", "getenv(", "env.", "Env."];

  const findings: Array<{ file: string; line: number; pattern: string }> = [];

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
            const line = lines[i]!;
            // Skip lines that use env vars properly
            if (ENV_TOKENS.some((t) => line.includes(t))) continue;
            for (const pattern of API_KEY_PATTERNS) {
              if (pattern.test(line)) {
                findings.push({ file: join(rel, entry.name), line: i + 1, pattern: pattern.source.substring(0, 30) });
              }
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
      ? "No hardcoded API keys found -- keys appear to be loaded from environment."
      : "Hardcoded API keys found in workspace source files.",
    details: { findings },
  };
}
