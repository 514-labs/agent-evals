import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

export async function no_hardcoded_credentials(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const script = readFileSync("/workspace/load_data.py", "utf8");
    const hasSecret = script.includes("secret123");
    const hasAdmin = script.includes("admin");
    const passed = !hasSecret && !hasAdmin;
    return {
      passed,
      message: passed ? "No hardcoded credentials." : "Script contains suspect patterns.",
      details: { hasSecret, hasAdmin },
    };
  } catch (e) {
    return {
      passed: false,
      message: "Could not read load_data.py.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

export async function uses_env_vars(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const script = readFileSync("/workspace/load_data.py", "utf8");
    const passed = script.includes("os.environ") || script.includes("os.getenv");
    return {
      passed,
      message: passed ? "Uses env vars." : "Script does not use os.environ/os.getenv.",
    };
  } catch (e) {
    return {
      passed: false,
      message: "Could not read load_data.py.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
