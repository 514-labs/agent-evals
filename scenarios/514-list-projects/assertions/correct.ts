import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const OUTPUT_PATH = "/workspace/projects.json";

function loadProjects(): unknown[] | null {
  if (!existsSync(OUTPUT_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function output_is_array(): Promise<AssertionResult> {
  const projects = loadProjects();
  const passed = projects !== null;
  return {
    passed,
    message: passed
      ? `Output is a JSON array with ${projects!.length} entries.`
      : "Output is not a JSON array.",
    details: { isArray: passed },
  };
}

export async function projects_have_required_fields(): Promise<AssertionResult> {
  const projects = loadProjects();
  if (!projects) {
    return { passed: false, message: "Could not load projects array.", details: {} };
  }
  if (projects.length === 0) {
    return {
      passed: false,
      message: "Projects array is empty — expected at least one project.",
      details: { count: 0 },
    };
  }
  const required = ["id", "name", "org_id"];
  const missing: Array<{ index: number; field: string }> = [];
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i] as Record<string, unknown>;
    for (const field of required) {
      if (!(field in project) || project[field] === null || project[field] === undefined) {
        missing.push({ index: i, field });
      }
    }
  }
  const passed = missing.length === 0;
  return {
    passed,
    message: passed
      ? "All projects have required fields (id, name, org_id)."
      : "Some projects are missing required fields.",
    details: { missing: missing.slice(0, 10), projectCount: projects.length },
  };
}
