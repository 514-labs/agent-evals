import type { AssertionContext } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("POSTGRES_URL") && ctx.env("CLICKHOUSE_URL"));
}

export async function api_does_not_hardcode_credentials(): Promise<boolean> {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const suspectPatterns = ["password", "secret", "5432", "9000"];
  const dirs = ["/workspace"];

  for (const dir of dirs) {
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".js") && !file.endsWith(".ts") && !file.endsWith(".py")) continue;
      try {
        const content = readFileSync(join(dir, file), "utf8");
        for (const pattern of suspectPatterns) {
          if (content.includes(pattern) && !content.includes("process.env") && !content.includes("os.environ")) {
            return false;
          }
        }
      } catch {
        continue;
      }
    }
  }
  return true;
}
