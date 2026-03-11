import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_hardcoded_connection_strings(ctx: AssertionContext): Promise<AssertionResult> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dirs = ["/workspace"];
  const badPatterns = ["localhost:5432", "localhost:9092", "localhost:8123"];
  let found = "";
  for (const dir of dirs) {
    try {
      for (const f of readdirSync(dir)) {
        if (!/\.(py|js|ts|json)$/.test(f)) continue;
        const content = readFileSync(join(dir, f), "utf8");
        for (const p of badPatterns) {
          if (
            content.includes(p) &&
            !content.includes("process.env") &&
            !content.includes("os.environ") &&
            !content.includes("REDPANDA_BROKER") &&
            !content.includes("POSTGRES_URL") &&
            !content.includes("CLICKHOUSE_URL")
          ) {
            found = join(dir, f);
            break;
          }
        }
      }
    } catch {
      continue;
    }
  }
  return {
    passed: !found,
    message: found ? `Hardcoded connection in ${found}.` : "No hardcoded connections.",
    details: found ? { found } : undefined,
  };
}
