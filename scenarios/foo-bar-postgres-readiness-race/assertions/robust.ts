import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync, existsSync } from "node:fs";

export async function uses_env_for_connection(): Promise<AssertionResult> {
  const path = "/workspace/start_app.py";
  if (!existsSync(path)) {
    return { passed: false, message: "start_app.py does not exist.", details: {} };
  }
  const content = readFileSync(path, "utf8");
  const passed = content.includes("os.environ") || content.includes("os.getenv") || content.includes("POSTGRES_URL");
  return {
    passed,
    message: passed ? "Uses env for connection." : "Does not use env vars for connection.",
    details: { passed },
  };
}
