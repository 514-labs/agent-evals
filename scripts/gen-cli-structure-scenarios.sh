#!/usr/bin/env bash
# Generates 7 decbench scenarios (one per CLI-shape variant) that exercise
# the same 5-task combined session that the experiments/cli-structure/ harness
# ran outside decbench.
#
# Each scenario:
#   - installs its variant's `moose` wrapper to /usr/local/bin/moose
#   - sets MOOSE_LOG_PATH=/workspace/moose.log
#   - asks the agent to perform five related ops in order
#   - asserts that all five canonical capabilities were exercised
#
# Wrappers are sourced from experiments/cli-structure/variants/<variant>/bin/moose
# and copied into each scenario's init/ directory.
#
# Usage: bash scripts/gen-cli-structure-scenarios.sh

set -euo pipefail

cd "$(dirname "$0")/.."

VARIANTS=(deep signposted surfaced shallow positional flag atomic)

variant_desc() {
  case "$1" in
    deep)        echo "3-level namespace (project/infra/data/runtime/integration/meta)" ;;
    signposted)  echo "Deep + canonical example invocations shown in the top-level --help" ;;
    surfaced)    echo "Deep + 7 top-level verb aliases (git-style: init, dev, build, logs, ps, ls, seed)" ;;
    shallow)     echo "mixed top-level verbs with some subcommand trees (mirrors real Moose)" ;;
    positional)  echo "every verb at the top level, category as positional argument" ;;
    flag)        echo "every verb at the top level, category and subtype as flags" ;;
    atomic)      echo "every capability is its own kebab-case top-level verb" ;;
  esac
}

variant_lede() {
  case "$1" in
    deep)        echo "The agent must navigate three nested namespaces to reach each operation." ;;
    signposted)  echo "The top-level help advertises canonical example invocations alongside the namespace listing." ;;
    surfaced)    echo "Both top-level shortcuts and full namespaced paths dispatch to the same capabilities." ;;
    shallow)     echo "Most verbs are top-level, with a small set of subcommanded trees (matches real Moose)." ;;
    positional)  echo "There is no per-subtree --help drill-down; the top-level help is the entire surface." ;;
    flag)        echo "Subcommands are exposed as --action / --source / --artifact flags." ;;
    atomic)      echo "Every operation has its own flat kebab-case verb; no hierarchy exists." ;;
  esac
}

mkdir -p scenarios

for variant in "${VARIANTS[@]}"; do
  id="cli-structure-${variant}"
  dir="scenarios/${id}"
  rm -rf "${dir}"
  mkdir -p "${dir}/init" "${dir}/harnesses/olap-for-swe/prompts" "${dir}/assertions"

  # Copy the wrapper from experiments/ into the scenario's init dir.
  cp "experiments/cli-structure/variants/${variant}/bin/moose" "${dir}/init/moose"
  chmod +x "${dir}/init/moose"

  # ---------- scenario.json ----------
  desc="$(variant_desc "$variant")"
  lede="$(variant_lede "$variant")"
  cat > "${dir}/scenario.json" <<JSON
{
  "id": "${id}",
  "title": "CLI shape: ${variant} (5-task session)",
  "description": "Exercises a 5-task session against a fake \`moose\` CLI whose surface uses the ${variant} shape: ${desc}. Measures whether the agent can complete all five related operations and how much exploration each shape demands.",
  "lede": "${lede} The agent must initialise a project, seed a remote ClickHouse, check running processes, list tables, and search logs, in that order.",
  "tier": "tier-1",
  "domain": "cli-design",
  "harnesses": [
    "olap-for-swe"
  ],
  "tasks": [
    {
      "id": "init",
      "description": "Initialise a Moose project named events using the python-ckh template.",
      "category": "cli-tooling"
    },
    {
      "id": "seed",
      "description": "Seed the local ClickHouse from a remote ClickHouse URL.",
      "category": "cli-tooling"
    },
    {
      "id": "ps",
      "description": "List the running Moose processes.",
      "category": "cli-tooling"
    },
    {
      "id": "ls",
      "description": "List the Tables in the running project.",
      "category": "cli-tooling"
    },
    {
      "id": "logs",
      "description": "Search the Moose logs for the term 'error'.",
      "category": "cli-tooling"
    }
  ],
  "infrastructure": {
    "services": [],
    "description": "No databases or external services. The simulated \`moose\` wrapper for the ${variant} variant is installed at /usr/local/bin/moose and logs every invocation as JSON to /workspace/moose.log."
  },
  "tags": [
    "cli",
    "cli-shape",
    "agent-ergonomics",
    "${variant}"
  ],
  "baselineMetrics": {
    "queryLatencyMs": 0,
    "storageBytes": 0,
    "costPerQueryUsd": 0
  },
  "referenceMetrics": {
    "queryLatencyMs": 0,
    "storageBytes": 0,
    "costPerQueryUsd": 0
  }
}
JSON

  # ---------- env.sh ----------
  cat > "${dir}/env.sh" <<'ENV'
#!/usr/bin/env bash
# No database services required for cli-structure scenarios.
ENV

  # ---------- supervisord.conf ----------
  cat > "${dir}/supervisord.conf" <<'SUP'
[supervisord]
nodaemon=false
logfile=/tmp/supervisord.log
pidfile=/tmp/supervisord.pid
SUP

  # ---------- init/setup.sh ----------
  cat > "${dir}/init/setup.sh" <<INIT
#!/usr/bin/env bash
# Installs the ${variant}-variant fake \`moose\` wrapper on PATH and points
# its log file at /workspace/moose.log so the assertions can inspect every
# command the agent issued.
set -euo pipefail

mkdir -p /workspace
: > /workspace/moose.log

cp "\$(dirname "\$0")/moose" /usr/local/bin/moose
chmod +x /usr/local/bin/moose

# Make sure every shell (including the agent's) points the wrapper at the
# log path the assertions read.
mkdir -p /etc/profile.d
cat > /etc/profile.d/moose-log-path.sh <<'EOF'
export MOOSE_LOG_PATH=/workspace/moose.log
EOF
chmod 644 /etc/profile.d/moose-log-path.sh

# Belt and braces: emit the same export into common login files so non-login
# shells pick it up too.
for rc in /root/.bashrc /root/.profile /etc/bash.bashrc; do
  [[ -f "\$rc" ]] || continue
  grep -q MOOSE_LOG_PATH "\$rc" || echo 'export MOOSE_LOG_PATH=/workspace/moose.log' >> "\$rc"
done

echo "moose wrapper (${variant}) installed at /usr/local/bin/moose"
echo "moose log will be written to /workspace/moose.log"
INIT
  chmod +x "${dir}/init/setup.sh"

  # ---------- harnesses/olap-for-swe/prompts/baseline.md ----------
  cat > "${dir}/harnesses/olap-for-swe/prompts/baseline.md" <<'PROMPT'
You have the `moose` CLI available on PATH. Complete these five tasks in the order given. Run one CLI command per task. Stop once every task has succeeded.

1. Initialise a new Moose project named `events` using the `python-ckh` template.
2. Seed the local ClickHouse from a remote ClickHouse database at `clickhouse://explorer@play.clickhouse.com:9440/default`.
3. Check which Moose processes are currently running.
4. List all of the Tables in the running Moose project.
5. Search the Moose logs for any lines containing the word `error`.
PROMPT

  # ---------- harnesses/olap-for-swe/prompts/informed.md ----------
  cat > "${dir}/harnesses/olap-for-swe/prompts/informed.md" <<'PROMPT'
You have the `moose` CLI available on PATH. Complete these five tasks in the order given. Run one CLI command per task. Stop once every task has succeeded.

This CLI's surface area is unfamiliar. Use `moose --help` and `moose <command> --help` (and any sub-subcommand --help) to discover the right invocation before guessing. Every successful command writes a structured line to `/workspace/moose.log`.

1. Initialise a new Moose project named `events` using the `python-ckh` template.
2. Seed the local ClickHouse from a remote ClickHouse database at `clickhouse://explorer@play.clickhouse.com:9440/default`.
3. Check which Moose processes are currently running.
4. List all of the Tables in the running Moose project.
5. Search the Moose logs for any lines containing the word `error`.
PROMPT

  # ---------- assertions/functional.ts ----------
  cat > "${dir}/assertions/functional.ts" <<'TS'
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
TS

  # ---------- assertions/correct.ts ----------
  cat > "${dir}/assertions/correct.ts" <<'TS'
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
TS

  # ---------- assertions/performant.ts ----------
  cat > "${dir}/assertions/performant.ts" <<'TS'
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
TS

  # ---------- assertions/robust.ts ----------
  cat > "${dir}/assertions/robust.ts" <<'TS'
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
TS

  # ---------- assertions/production.ts ----------
  cat > "${dir}/assertions/production.ts" <<'TS'
import type { AssertionResult } from "@dec-bench/eval-core";

// CLI-shape scenarios do not produce a code artifact; the production gate
// is satisfied trivially. The decbench production gate elsewhere in this
// repo enforces line-count and dead-code rules on agent-authored sources;
// this scenario's surface is the agent's command sequence, not source code.
export async function no_code_artifact_required(): Promise<AssertionResult> {
  return {
    passed: true,
    message: "Scenario does not require a code artifact; production gate is N/A.",
    details: {},
  };
}
TS

  # ---------- apps/web/data/scenarios/<id>.json (registry) ----------
  reg_dir="apps/web/data/scenarios"
  mkdir -p "${reg_dir}"
  cat > "${reg_dir}/${id}.json" <<JSON
{
  "id": "${id}",
  "title": "CLI shape: ${variant} (5-task session)",
  "description": "Exercises a 5-task session against a fake \`moose\` CLI whose surface uses the ${variant} shape: ${desc}. Measures whether the agent can complete all five related operations and how much exploration each shape demands.",
  "tier": "tier-1",
  "domain": "cli-design",
  "startingState": "greenfield",
  "competencies": ["environment-setup"],
  "features": [],
  "taskCategories": ["cli-tooling"],
  "harnesses": ["olap-for-swe"],
  "taskCount": 5,
  "services": [],
  "tags": ["cli", "cli-shape", "agent-ergonomics", "${variant}"]
}
JSON

  echo "✓ generated ${dir} and ${reg_dir}/${id}.json"
done

echo
echo "Generated ${#VARIANTS[@]} scenarios under scenarios/cli-structure-*/ and registry entries under apps/web/data/scenarios/"
