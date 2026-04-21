import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const OUTPUT_PATH = "/workspace/projects.json";

export async function output_file_exists(): Promise<AssertionResult> {
  const exists = existsSync(OUTPUT_PATH);
  return {
    passed: exists,
    message: exists
      ? `Output file exists at ${OUTPUT_PATH}.`
      : `Output file not found at ${OUTPUT_PATH}.`,
    details: { path: OUTPUT_PATH },
  };
}

export async function output_is_valid_json(): Promise<AssertionResult> {
  if (!existsSync(OUTPUT_PATH)) {
    return { passed: false, message: "Output file does not exist.", details: {} };
  }
  try {
    const content = readFileSync(OUTPUT_PATH, "utf8");
    JSON.parse(content);
    return { passed: true, message: "Output is valid JSON.", details: {} };
  } catch (error) {
    return {
      passed: false,
      message: "Output is not valid JSON.",
      details: { error: String(error) },
    };
  }
}
