import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const MOOSE_LOG = "/workspace/moose.log";

function errorCount(): number {
  if (!existsSync(MOOSE_LOG)) return 0;
  return readFileSync(MOOSE_LOG, "utf8")
    .split("\n")
    .filter((l) => {
      try {
        const obj = JSON.parse(l);
        return String(obj.result ?? "").startsWith("error:");
      } catch {
        return false;
      }
    }).length;
}

export async function under_4_unknown_command_errors(): Promise<AssertionResult> {
  const errs = errorCount();
  const passed = errs <= 4;
  return {
    passed,
    message: passed
      ? `Agent triggered ${errs} unknown-command error(s) (<= 4).`
      : `Agent triggered ${errs} unknown-command errors (> 4); the surface confused it.`,
    details: { errors: errs, threshold: 4 },
  };
}
