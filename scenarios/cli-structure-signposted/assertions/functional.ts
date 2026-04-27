import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const MOOSE_LOG = "/workspace/moose.log";

function loadInvocations(): Array<Record<string, unknown>> {
  if (!existsSync(MOOSE_LOG)) return [];
  return readFileSync(MOOSE_LOG, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((x): x is Record<string, unknown> => x !== null);
}

export async function moose_log_exists(): Promise<AssertionResult> {
  const exists = existsSync(MOOSE_LOG);
  return {
    passed: exists,
    message: exists
      ? `Wrapper log present at ${MOOSE_LOG}.`
      : `Wrapper log not found at ${MOOSE_LOG}; agent never invoked the moose wrapper.`,
    details: { path: MOOSE_LOG },
  };
}

export async function moose_invoked_at_least_once(): Promise<AssertionResult> {
  const invocations = loadInvocations();
  return {
    passed: invocations.length > 0,
    message: invocations.length > 0
      ? `Agent issued ${invocations.length} moose invocation(s).`
      : "Agent issued zero moose invocations.",
    details: { count: invocations.length },
  };
}
