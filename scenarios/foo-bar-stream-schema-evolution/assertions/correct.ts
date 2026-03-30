import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function schema_supports_region_field(ctx: AssertionContext): Promise<AssertionResult> {
  const workspace = "/workspace";
  try {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = readdirSync(workspace);
    const schemaFiles = files.filter(
      (f) => f.endsWith(".avsc") || f.endsWith(".json") || f.includes("schema"),
    );
    let foundRegion = false;
    for (const f of schemaFiles) {
      const content = readFileSync(join(workspace, f), "utf8");
      if (content.includes("region") && (content.includes("null") || content.includes("optional"))) {
        foundRegion = true;
        break;
      }
    }
    if (schemaFiles.length === 0) {
      return {
        passed: false,
        message: "No schema files found in workspace — expected .avsc, .json, or schema-related files.",
        details: { schemaFiles },
      };
    }
    return {
      passed: foundRegion,
      message: foundRegion
        ? "Schema supports optional region field."
        : "Schema does not include optional region field.",
      details: { schemaFiles, foundRegion },
    };
  } catch (e: any) {
    return {
      passed: false,
      message: `Error reading schema files: ${e.message?.slice(0, 200)}`,
      details: {},
    };
  }
}
