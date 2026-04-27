import { existsSync, readFileSync } from "node:fs";

import type { AssertionResult } from "@dec-bench/eval-core";

const MOOSE_LOG = "/workspace/moose.log";
const REQUIRED_CAPS = ["init", "seed:clickhouse", "ps", "ls", "logs"] as const;

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

function matchedCapabilities(): Set<string> {
  const matched = new Set<string>();
  for (const inv of loadInvocations()) {
    const result = String(inv.result ?? "");
    if (result.startsWith("matched:")) {
      matched.add(result.slice("matched:".length));
    }
  }
  return matched;
}

export async function all_required_capabilities_matched(): Promise<AssertionResult> {
  const matched = matchedCapabilities();
  const missing = REQUIRED_CAPS.filter((c) => !matched.has(c));
  const passed = missing.length === 0;
  return {
    passed,
    message: passed
      ? `All ${REQUIRED_CAPS.length} required capabilities were exercised: ${REQUIRED_CAPS.join(", ")}.`
      : `Missing capabilities: ${missing.join(", ")}. Matched: ${[...matched].join(", ") || "(none)"}.`,
    details: {
      required: [...REQUIRED_CAPS],
      matched: [...matched],
      missing,
    },
  };
}

export async function init_capability_matched(): Promise<AssertionResult> {
  const matched = matchedCapabilities();
  return {
    passed: matched.has("init"),
    message: matched.has("init")
      ? "Project initialisation succeeded."
      : "Agent never successfully initialised the project.",
    details: {},
  };
}

export async function seed_capability_matched(): Promise<AssertionResult> {
  const matched = matchedCapabilities();
  return {
    passed: matched.has("seed:clickhouse"),
    message: matched.has("seed:clickhouse")
      ? "ClickHouse seed succeeded."
      : "Agent never successfully seeded ClickHouse.",
    details: {},
  };
}

export async function logs_capability_matched(): Promise<AssertionResult> {
  const matched = matchedCapabilities();
  return {
    passed: matched.has("logs"),
    message: matched.has("logs")
      ? "Logs search succeeded."
      : "Agent never successfully searched the logs.",
    details: {},
  };
}
