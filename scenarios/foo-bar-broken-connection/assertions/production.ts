import type { AssertionContext } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

export async function no_hardcoded_credentials(ctx: AssertionContext): Promise<boolean> {
  try {
    const script = readFileSync("/workspace/load_data.py", "utf8");
    return !script.includes("secret123") && !script.includes("admin");
  } catch {
    return false;
  }
}

export async function uses_env_vars(ctx: AssertionContext): Promise<boolean> {
  try {
    const script = readFileSync("/workspace/load_data.py", "utf8");
    return script.includes("os.environ") || script.includes("os.getenv");
  } catch {
    return false;
  }
}
