import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const MOOSE_LOG = "/workspace/moose.log";

// On the headline 5-task session in the parallel experiment harness, Surfaced
// completed in 5 commands (zero help reads, zero errors); Atomic took 11.6
// commands on average. Pass at <=15 invocations: enough headroom that even a
// confused run on a deeply nested variant should clear it, but a hopelessly
// stuck run that just bashes --help repeatedly will fail.
const MAX_INVOCATIONS = 15;

function invocationCount(): number {
  if (!existsSync(MOOSE_LOG)) return 0;
  return readFileSync(MOOSE_LOG, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0).length;
}

export async function under_15_invocations(): Promise<AssertionResult> {
  const count = invocationCount();
  return {
    passed: count > 0 && count <= MAX_INVOCATIONS,
    message:
      count === 0
        ? "Agent issued zero moose commands."
        : count <= MAX_INVOCATIONS
          ? `Agent completed the session in ${count} invocations (<= ${MAX_INVOCATIONS}).`
          : `Agent took ${count} invocations to complete the session (> ${MAX_INVOCATIONS}).`,
    details: { count, threshold: MAX_INVOCATIONS },
  };
}

export async function help_reads_under_3(): Promise<AssertionResult> {
  if (!existsSync(MOOSE_LOG)) {
    return {
      passed: false,
      message: "moose.log not present; cannot evaluate help-read count.",
      details: {},
    };
  }
  const helpReads = readFileSync(MOOSE_LOG, "utf8")
    .split("\n")
    .filter((l) => {
      try {
        const obj = JSON.parse(l);
        return String(obj.result ?? "").startsWith("help:");
      } catch {
        return false;
      }
    }).length;
  const passed = helpReads <= 3;
  return {
    passed,
    message: passed
      ? `Agent read --help ${helpReads} time(s) (<= 3).`
      : `Agent read --help ${helpReads} times (> 3); the session was unusually exploration-heavy.`,
    details: { helpReads, threshold: 3 },
  };
}
