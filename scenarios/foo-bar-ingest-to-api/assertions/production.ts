import type { AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function api_does_not_hardcode_credentials(): Promise<AssertionResult> {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const suspectPatterns = ["password", "secret", "5432", "9000"];
  const dirs = ["/workspace"];
  let foundFile = "";

  outer: for (const dir of dirs) {
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
            foundFile = join(dir, file);
            break outer;
          }
        }
      } catch {
        continue;
      }
    }
  }
  const passed = !foundFile;
  return {
    passed,
    message: passed ? "No hardcoded credentials found." : `Suspect pattern found in ${foundFile}.`,
    details: foundFile ? { foundFile } : undefined,
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
