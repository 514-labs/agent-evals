import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync, existsSync } from "node:fs";

export async function startup_has_retry_logic(): Promise<AssertionResult> {
  const path = "/workspace/start_app.py";
  if (!existsSync(path)) {
    return { passed: false, message: "start_app.py does not exist.", details: {} };
  }
  const content = readFileSync(path, "utf8");
  const hasRetry = /retry|while|for.*range|sleep|backoff|wait/i.test(content);
  const hasSleep = /sleep|time\.sleep|backoff/i.test(content);
  const passed = hasRetry && hasSleep;
  return {
    passed,
    message: passed ? "Startup has retry logic." : "Startup script lacks retry/backoff.",
    details: { hasRetry, hasSleep },
  };
}
