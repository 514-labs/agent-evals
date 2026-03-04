import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_hardcoded_credentials(ctx: AssertionContext): Promise<AssertionResult> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dirs = ["/workspace"];
  const suspectPatterns = ["password", "secret", "5432"];
  let found = "";
  for (const dir of dirs) {
    try {
      for (const f of readdirSync(dir)) {
        if (!/\.(py|js|ts|json)$/.test(f)) continue;
        const content = readFileSync(join(dir, f), "utf8");
        for (const p of suspectPatterns) {
          if (content.includes(p) && !content.includes("process.env") && !content.includes("os.environ")) {
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
    message: found ? `Hardcoded credentials in ${found}.` : "No hardcoded credentials.",
    details: found ? { found } : undefined,
  };
}
