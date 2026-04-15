import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function no_errors_in_application_logs(ctx: AssertionContext): Promise<AssertionResult> {
  const { readFileSync, existsSync } = await import("node:fs");

  // Check common log locations for errors after the fixes
  const logPaths = [
    "/tmp/taxi-pipeline.log",
    "/tmp/taxi-api.log",
    "/workspace/logs/error.log",
  ];

  const errors: Array<{ file: string; line: string }> = [];

  for (const logPath of logPaths) {
    if (!existsSync(logPath)) continue;
    try {
      const content = readFileSync(logPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (/\b(Error|TypeError|ReferenceError|SyntaxError|FATAL)\b/i.test(line) && !/\bno error/i.test(line)) {
          errors.push({ file: logPath, line: line.substring(0, 200) });
          if (errors.length >= 5) break;
        }
      }
    } catch {}
  }

  // Also check that the TypeScript compiles cleanly as a proxy for "no errors"
  const { execSync } = await import("node:child_process");
  try {
    execSync("npx tsc --noEmit", { cwd: "/workspace", timeout: 30000, stdio: "pipe" });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    errors.push({ file: "tsc --noEmit", line: stderr.substring(0, 200) });
  }

  const passed = errors.length === 0;
  return {
    passed,
    message: passed
      ? "No errors found in application logs or compilation."
      : `Found ${errors.length} error(s) in logs or compilation.`,
    details: { errors },
  };
}
