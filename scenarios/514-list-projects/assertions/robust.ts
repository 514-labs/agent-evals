import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const OUTPUT_PATH = "/workspace/projects.json";

export async function output_file_is_only_json(): Promise<AssertionResult> {
  if (!existsSync(OUTPUT_PATH)) {
    return { passed: false, message: "Output file does not exist.", details: {} };
  }
  const content = readFileSync(OUTPUT_PATH, "utf8").trim();
  const startsClean = content.startsWith("[") || content.startsWith("{");
  return {
    passed: startsClean,
    message: startsClean
      ? "Output file contains only JSON (no preamble or shell artifacts)."
      : "Output file contains non-JSON content before the data.",
    details: { firstChars: content.slice(0, 40) },
  };
}
