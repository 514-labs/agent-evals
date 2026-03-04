import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_hardcoded_broker(ctx: AssertionContext): Promise<AssertionResult> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dirs = ["/workspace"];
  let found = "";
  for (const dir of dirs) {
    try {
      for (const f of readdirSync(dir)) {
        if (!/\.(py|js|ts|json)$/.test(f)) continue;
        const content = readFileSync(join(dir, f), "utf8");
        if (content.includes("localhost:9092") && !content.includes("REDPANDA_BROKER") && !content.includes("os.environ")) {
          found = join(dir, f);
          break;
        }
      }
    } catch {
      continue;
    }
  }
  return {
    passed: !found,
    message: found ? `Hardcoded broker in ${found}.` : "No hardcoded broker found.",
    details: found ? { found } : undefined,
  };
}
