import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { promisify } from "node:util";

import type {
  BaselineMetrics,
  ObservedMetrics,
  ReferenceMetrics,
  Scenario,
  ScenarioProductionChecks,
} from "@dec-bench/scenarios";

import type { AssertionContext } from "./context.js";
import { loadScenarioAssertions, type AssertionFn } from "./discovery.js";
import type {
  AssertionLogMap,
  AssertionLogOutput,
  EvalOutput,
  GateName,
  GateResult,
  ProductionThresholds,
  ScenarioProductionConfig,
} from "./types.js";
import { createEvalOutput } from "./output.js";
import { computeScore } from "./score.js";

const GATES: GateName[] = ["functional", "correct", "robust", "performant", "production"];
const PASS_THRESHOLD = 0.8;
const DEFAULT_WORKSPACE_ROOT = "/workspace";
const MAX_TEXT_FILE_BYTES = 512_000;
const IGNORED_SCAN_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
]);
const SECRET_PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "anthropic_api_key", regex: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "openai_api_key", regex: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/g },
  { kind: "github_token", regex: /\b(?:ghp|gho|ghu)_[A-Za-z0-9]{20,}\b/g },
  { kind: "github_pat", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { kind: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "slack_token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
];
const GENERIC_SECRET_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[:=]\s*["']([^"'$\n]{5,})["']/gi;
const DEFAULT_PRODUCTION_THRESHOLDS_BY_TIER: Record<string, ProductionThresholds> = {
  "tier-1": { maxExpectedLines: 200, maxFileLines: 250 },
  "tier-2": { maxExpectedLines: 350, maxFileLines: 250 },
  "tier-3": { maxExpectedLines: 500, maxFileLines: 250 },
};
const OUTPUT_LINE_REASONABLE_MULTIPLIER = 1.25;
const QUALITY_SCAN_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".scala",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
]);
const QUALITY_SCAN_FILENAMES = new Set(["dockerfile", "makefile", "justfile"]);
const DEAD_CODE_MARKERS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "todo_marker", regex: /\bTODO\b/i },
  { kind: "fixme_marker", regex: /\bFIXME\b/i },
  { kind: "hack_marker", regex: /\bHACK\b/i },
  { kind: "xxx_marker", regex: /\bXXX\b/i },
  { kind: "not_implemented", regex: /\b(?:not implemented|NotImplementedError)\b/i },
  { kind: "placeholder_marker", regex: /\bplaceholder\b/i },
];
const DEBUG_ARTIFACT_PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "console_log", regex: /\bconsole\.log\s*\(/ },
  { kind: "debugger_statement", regex: /\bdebugger;?/ },
  { kind: "python_breakpoint", regex: /\b(?:breakpoint|pdb\.set_trace)\s*\(/ },
  { kind: "rust_dbg_macro", regex: /\bdbg!\s*\(/ },
];
const DEBUG_FILE_PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "scratch_file", regex: /(?:^|[._-])(debug|scratch|tmp|temp)(?:[._-]|$)/i },
  { kind: "backup_file", regex: /\.(?:bak|orig|tmp)$/i },
];
const SOURCE_SCAN_EXTENSIONS = new Set([".py", ".js", ".jsx", ".ts", ".tsx", ".rs", ".go", ".java"]);

const execFileAsync = promisify(execFile);

export interface GateRunnerOptions {
  assertionsDir: string;
  context: AssertionContext;
  processExitCode: number;
  sessionLogPath?: string;
  workspaceRoot?: string;
  secretScanRoot?: string;
  idempotentRerunCommand?: string;
  scenario: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  runMetadata?: EvalOutput["run_metadata"];
  efficiency: EvalOutput["efficiency"];
  baselineMetrics?: BaselineMetrics;
  referenceMetrics?: ReferenceMetrics;
  observedMetrics?: ObservedMetrics;
}

export async function runGateEvaluation(
  options: GateRunnerOptions,
): Promise<{ output: EvalOutput; assertionLogs: AssertionLogOutput }> {
  const discovered = await loadScenarioAssertions(options.assertionsDir);
  const scenarioProductionConfig = loadScenarioProductionConfig(options.assertionsDir);
  const gates: Record<GateName, GateResult> = {
    functional: emptyGate(),
    correct: emptyGate(),
    robust: emptyGate(),
    performant: emptyGate(),
    production: emptyGate(),
  };
  const assertionLogs: AssertionLogOutput = {
    functional: { core: {}, scenario: {} },
    correct: { core: {}, scenario: {} },
    robust: { core: {}, scenario: {} },
    performant: { core: {}, scenario: {} },
    production: { core: {}, scenario: {} },
  };

  let blocked = false;
  let highestGate = 0;

  for (const gate of GATES) {
    if (blocked) {
      gates[gate] = emptyGate();
      continue;
    }

    const core = await runAssertions(
      getCoreAssertions(gate, {
        processExitCode: options.processExitCode,
        sessionLogPath: options.sessionLogPath,
        workspaceRoot: options.workspaceRoot,
        secretScanRoot: options.secretScanRoot,
        idempotentRerunCommand: options.idempotentRerunCommand,
        productionConfig: scenarioProductionConfig,
      }),
      options.context,
    );
    const scenario = await runAssertions(discovered[gate], options.context);
    const corePassed = allPassed(core.results);
    const scenarioScore = calcScore(scenario.results);
    const passed = corePassed && scenarioScore >= PASS_THRESHOLD;

    gates[gate] = {
      passed,
      score: scenarioScore,
      core: core.results,
      scenario: scenario.results,
    };
    assertionLogs[gate] = {
      core: core.logs,
      scenario: scenario.logs,
    };

    if (passed) {
      highestGate += 1;
    } else {
      blocked = true;
    }
  }

  let compositeScore: EvalOutput["composite_score"];
  if (options.baselineMetrics && options.referenceMetrics && options.observedMetrics) {
    const breakdown = computeScore(
      options.baselineMetrics,
      options.referenceMetrics,
      options.observedMetrics,
    );
    compositeScore = {
      total: breakdown.total,
      components: breakdown.components,
    };
  }

  return {
    output: createEvalOutput({
      scenario: options.scenario,
      version: options.version,
      harness: options.harness,
      agent: options.agent,
      model: options.model,
      runMetadata: options.runMetadata,
      highestGate,
      normalizedScore: calcNormalizedScore(gates, highestGate),
      compositeScore,
      gates,
      efficiency: options.efficiency,
    }),
    assertionLogs,
  };
}

interface CoreAssertionOptions {
  processExitCode: number;
  sessionLogPath?: string;
  workspaceRoot?: string;
  secretScanRoot?: string;
  idempotentRerunCommand?: string;
  productionConfig: ScenarioProductionConfig;
}

function emptyGate(): GateResult {
  return {
    passed: false,
    score: 0,
    core: {},
    scenario: {},
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calcNormalizedScore(gates: Record<GateName, GateResult>, highestGate: number): number {
  if (highestGate >= GATES.length) {
    return 1;
  }

  const failedGateName = GATES[highestGate];
  const failedGate = failedGateName ? gates[failedGateName] : undefined;
  const failedGateFraction = failedGate ? calcAssertionFraction(failedGate) : 0;
  return clamp((highestGate + failedGateFraction) / GATES.length);
}

function calcAssertionFraction(gate: GateResult): number {
  const passedAssertions =
    countPassedAssertions(gate.core) + countPassedAssertions(gate.scenario);
  const totalAssertions = countAssertions(gate.core) + countAssertions(gate.scenario);
  if (totalAssertions === 0) {
    return 0;
  }

  return clamp(passedAssertions / totalAssertions);
}

function calcScore(resultMap: Record<string, boolean>): number {
  const entries = Object.values(resultMap);
  if (entries.length === 0) {
    return 1;
  }

  const passedCount = entries.filter(Boolean).length;
  return clamp(passedCount / entries.length);
}

function allPassed(resultMap: Record<string, boolean>): boolean {
  return Object.values(resultMap).every(Boolean);
}

function countPassedAssertions(resultMap: Record<string, boolean>): number {
  return Object.values(resultMap).filter(Boolean).length;
}

function countAssertions(resultMap: Record<string, boolean>): number {
  return Object.keys(resultMap).length;
}

async function runAssertions(
  assertions: Record<string, AssertionFn>,
  context: AssertionContext,
): Promise<{ results: Record<string, boolean>; logs: AssertionLogMap }> {
  const results: Record<string, boolean> = {};
  const logs: AssertionLogMap = {};
  for (const [name, fn] of Object.entries(assertions)) {
    const started = Date.now();
    try {
      const outcome = await fn(context);
      const passed = Boolean(outcome.passed);
      results[name] = passed;
      logs[name] = {
        passed,
        durationMs: Date.now() - started,
        message: outcome.message,
        details: outcome.details,
      };
    } catch (error) {
      results[name] = false;
      logs[name] = {
        passed: false,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      };
    }
  }
  return { results, logs };
}

function getCoreAssertions(
  gate: GateName,
  options: CoreAssertionOptions,
): Record<string, AssertionFn> {
  if (gate === "functional") {
    return {
      process_exits_clean: async () => ({
        passed: options.processExitCode === 0,
        message:
          options.processExitCode === 0
            ? "Agent process exited cleanly."
            : `Agent process exited with code ${options.processExitCode}.`,
        details: { exitCode: options.processExitCode },
      }),
      no_unhandled_errors: async () => {
        if (!options.sessionLogPath) {
          return {
            passed: true,
            message: "Session log path unavailable; unhandled error scan skipped.",
          };
        }
        const sessionLog = safeRead(options.sessionLogPath);
        if (!sessionLog) {
          return {
            passed: true,
            message: "Session log missing or unreadable; unhandled error scan skipped.",
            details: { sessionLogPath: options.sessionLogPath },
          };
        }
        const passed = !/unhandled|traceback|panic:/i.test(sessionLog);
        return {
          passed,
          message: passed
            ? "No unhandled errors, tracebacks, or panics found in session log."
            : "Unhandled error indicators found in session log.",
          details: { sessionLogPath: options.sessionLogPath },
        };
      },
    };
  }

  if (gate === "robust") {
    return {
      idempotent_rerun: async () => runIdempotentRerunAssertion(options),
    };
  }

  if (gate === "production") {
    return {
      uses_env_vars: async (ctx) => {
        const supervisord = safeRead("/etc/supervisord.conf") ?? "";
        const needsPostgres = supervisord.includes("[program:postgres]");
        const needsClickHouse = supervisord.includes("[program:clickhouse]");
        const needsRedpanda = supervisord.includes("[program:redpanda]");

        const checks: { name: string; envVar: string; present: boolean }[] = [];
        if (needsPostgres) checks.push({ name: "postgres", envVar: "POSTGRES_URL", present: Boolean(ctx.env("POSTGRES_URL")) });
        if (needsClickHouse) checks.push({ name: "clickhouse", envVar: "CLICKHOUSE_URL", present: Boolean(ctx.env("CLICKHOUSE_URL")) });
        if (needsRedpanda) checks.push({ name: "redpanda", envVar: "REDPANDA_BROKER", present: Boolean(ctx.env("REDPANDA_BROKER")) });

        const missing = checks.filter((c) => !c.present).map((c) => c.envVar);
        const passed = missing.length === 0;
        return {
          passed,
          message: passed
            ? "Required data store environment variables are available."
            : `Missing required data store environment variables: ${missing.join(", ")}.`,
          details: Object.fromEntries(checks.map((c) => [c.envVar, c.present])),
        };
      },
      no_secrets_in_code: async () =>
        runSecretScanAssertion(options.secretScanRoot ?? options.workspaceRoot),
      output_line_count_reasonable: async () =>
        runOutputLineCountAssertion(options.workspaceRoot, options.productionConfig, "reasonable"),
      output_line_count_disciplined: async () =>
        runOutputLineCountAssertion(options.workspaceRoot, options.productionConfig, "disciplined"),
      no_dead_code_markers: async () =>
        runDeadCodeMarkerAssertion(options.workspaceRoot, options.productionConfig),
      files_are_reasonably_sized: async () =>
        runFileSizeAssertion(options.workspaceRoot, options.productionConfig),
      no_debug_artifacts: async () =>
        runDebugArtifactAssertion(options.workspaceRoot, options.productionConfig),
      zero_compiler_errors: async () =>
        runCompilerAssertion(options.workspaceRoot, options.productionConfig),
      zero_lint_errors: async () =>
        runLintAssertion(options.workspaceRoot, options.productionConfig),
      has_type_safety: async () =>
        runTypeSafetyAssertion(options.workspaceRoot, options.productionConfig),
      functions_are_focused: async () =>
        runFocusedFunctionsAssertion(options.workspaceRoot, options.productionConfig),
      no_deep_nesting: async () =>
        runDeepNestingAssertion(options.workspaceRoot, options.productionConfig),
    };
  }

  return {};
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

async function runIdempotentRerunAssertion(options: CoreAssertionOptions) {
  const workspaceRoot = resolveRootPath(options.workspaceRoot) ?? DEFAULT_WORKSPACE_ROOT;
  const rerunCommand = options.idempotentRerunCommand?.trim();

  if (rerunCommand) {
    return runConfiguredIdempotentRerun(rerunCommand, workspaceRoot);
  }

  if (!options.sessionLogPath) {
    return {
      passed: true,
      message: "No rerun command configured; session-log heuristic found no idempotency risk markers.",
      details: { mode: "session-log-heuristic", sessionLogPath: null },
    };
  }

  const sessionLog = safeRead(options.sessionLogPath);
  if (!sessionLog) {
    return {
      passed: true,
      message: "No rerun command configured; session-log heuristic could not read the session log.",
      details: { mode: "session-log-heuristic", sessionLogPath: options.sessionLogPath },
    };
  }

  const failureMarkers = collectMatchingLines(sessionLog, isIdempotencyFailureLine);
  const signalMarkers = collectMatchingLines(sessionLog, isIdempotencySignalLine);
  const passed = failureMarkers.length === 0;

  return {
    passed,
    message: passed
      ? signalMarkers.length > 0
        ? "No idempotency failure markers found; session log contains rerun-safety signals."
        : "No idempotency failure markers found in session log."
      : "Idempotency risk markers found in session log.",
    details: {
      mode: "session-log-heuristic",
      sessionLogPath: options.sessionLogPath,
      signalMarkers,
      failureMarkers,
    },
  };
}

async function runConfiguredIdempotentRerun(rerunCommand: string, workspaceRoot: string) {
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: false,
      message: "Configured rerun command could not run because the workspace root is unavailable.",
      details: { mode: "configured-rerun", rerunCommand, workspaceRoot },
    };
  }

  try {
    const firstRun = await execFileAsync("/bin/bash", ["-lc", rerunCommand], {
      cwd: workspaceRoot,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const firstSnapshot = hashWorkspaceState(workspaceRoot);

    const secondRun = await execFileAsync("/bin/bash", ["-lc", rerunCommand], {
      cwd: workspaceRoot,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const secondSnapshot = hashWorkspaceState(workspaceRoot);
    const passed = firstSnapshot.hash === secondSnapshot.hash;

    return {
      passed,
      message: passed
        ? "Configured rerun command produced the same workspace state on consecutive runs."
        : "Configured rerun command changed the workspace on the second run.",
      details: {
        mode: "configured-rerun",
        rerunCommand,
        workspaceRoot,
        firstRun: summarizeCommandOutput(firstRun.stdout, firstRun.stderr),
        secondRun: summarizeCommandOutput(secondRun.stdout, secondRun.stderr),
        firstSnapshot,
        secondSnapshot,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: "Configured rerun command failed to execute successfully.",
      details: {
        mode: "configured-rerun",
        rerunCommand,
        workspaceRoot,
        error: formatExecError(error),
      },
    };
  }
}

async function runSecretScanAssertion(root: string | undefined) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; secret scan skipped.",
      details: { workspaceRoot },
    };
  }

  const scan = scanWorkspaceForSecrets(workspaceRoot);
  const passed = scan.findings.length === 0;

  return {
    passed,
    message: passed
      ? "No hardcoded secrets detected in workspace files."
      : "Potential hardcoded secrets detected in workspace files.",
    details: {
      workspaceRoot,
      scannedFiles: scan.scannedFiles,
      totalFindings: scan.totalFindings,
      findings: scan.findings,
    },
  };
}

interface WorkspaceQualityFile {
  relativePath: string;
  text: string;
  lineCount: number;
}

type PartialScenarioDefinition = Pick<Scenario, "tier" | "productionChecks">;

function loadScenarioProductionConfig(assertionsDir: string): ScenarioProductionConfig {
  const raw = safeRead(join(assertionsDir, "..", "scenario.json"));
  if (!raw) {
    return {
      thresholds: resolveProductionThresholds(undefined, undefined),
    };
  }

  try {
    const parsed = JSON.parse(raw) as PartialScenarioDefinition;
    return {
      tier: parsed.tier,
      thresholds: resolveProductionThresholds(parsed.tier, parsed.productionChecks),
    };
  } catch {
    return {
      thresholds: resolveProductionThresholds(undefined, undefined),
    };
  }
}

function resolveProductionThresholds(
  tier: string | undefined,
  overrides: ScenarioProductionChecks | undefined,
): ProductionThresholds {
  const defaults =
    DEFAULT_PRODUCTION_THRESHOLDS_BY_TIER[tier ?? ""] ?? DEFAULT_PRODUCTION_THRESHOLDS_BY_TIER["tier-2"];

  return {
    maxExpectedLines: sanitizeThreshold(overrides?.maxExpectedLines, defaults.maxExpectedLines),
    maxFileLines: sanitizeThreshold(overrides?.maxFileLines, defaults.maxFileLines),
  };
}

function sanitizeThreshold(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

async function runOutputLineCountAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
  mode: "reasonable" | "disciplined",
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; output line-count check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const files = collectWorkspaceQualityFiles(workspaceRoot);
  const totalLines = files.reduce((sum, file) => sum + file.lineCount, 0);
  const maxLines =
    mode === "reasonable"
      ? Math.ceil(config.thresholds.maxExpectedLines * OUTPUT_LINE_REASONABLE_MULTIPLIER)
      : config.thresholds.maxExpectedLines;
  const passed = totalLines <= maxLines;
  const budgetLabel = mode === "reasonable" ? "hard" : "target";

  return {
    passed,
    message: passed
      ? `Workspace output stays within the ${budgetLabel} ${maxLines}-line budget.`
      : `Workspace output exceeds the ${budgetLabel} ${maxLines}-line budget.`,
    details: {
      workspaceRoot,
      tier: config.tier,
      mode,
      totalLines,
      maxExpectedLines: config.thresholds.maxExpectedLines,
      maxLines,
      scannedFiles: files.length,
      largestFiles: files
        .slice()
        .sort((left, right) => right.lineCount - left.lineCount)
        .slice(0, 5)
        .map((file) => ({ file: file.relativePath, lineCount: file.lineCount })),
    },
  };
}

async function runDeadCodeMarkerAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; dead-code marker check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const findings = collectWorkspaceLineFindings(workspaceRoot, DEAD_CODE_MARKERS);
  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No dead-code markers detected in workspace files."
      : "Dead-code markers detected in workspace files.",
    details: {
      workspaceRoot,
      totalFindings: findings.length,
      findings: findings.slice(0, 10),
    },
  };
}

async function runFileSizeAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; file-size check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const offenders = collectWorkspaceQualityFiles(workspaceRoot)
    .filter((file) => file.lineCount > config.thresholds.maxFileLines)
    .sort((left, right) => right.lineCount - left.lineCount);
  const passed = offenders.length === 0;

  return {
    passed,
    message: passed
      ? `No workspace file exceeds ${config.thresholds.maxFileLines} lines.`
      : `One or more workspace files exceed ${config.thresholds.maxFileLines} lines.`,
    details: {
      workspaceRoot,
      tier: config.tier,
      maxFileLines: config.thresholds.maxFileLines,
      offenders: offenders.slice(0, 10).map((file) => ({
        file: file.relativePath,
        lineCount: file.lineCount,
      })),
    },
  };
}

async function runDebugArtifactAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; debug-artifact check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const lineFindings = collectWorkspaceLineFindings(workspaceRoot, DEBUG_ARTIFACT_PATTERNS);
  const fileFindings = collectWorkspaceFileFindings(workspaceRoot);
  const findings = [...fileFindings, ...lineFindings].slice(0, 10);
  const passed = fileFindings.length + lineFindings.length === 0;

  return {
    passed,
    message: passed
      ? "No obvious debug artifacts detected in workspace files."
      : "Debug artifacts detected in workspace files.",
    details: {
      workspaceRoot,
      totalFindings: fileFindings.length + lineFindings.length,
      findings,
    },
  };
}

async function runCompilerAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; compiler check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }
  const command = resolveCompilerCommand(workspaceRoot);
  if (!command) {
    return {
      passed: true,
      message: "No supported compiler target detected; compiler check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  return runWorkspaceCommandAssertion(
    workspaceRoot,
    command,
    "Compiler check passed with zero errors.",
    "Compiler check failed.",
  );
}

async function runLintAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; lint check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }
  const command = resolveLintCommand(workspaceRoot);
  if (!command) {
    return {
      passed: true,
      message: "No supported lint configuration detected; lint check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  return runWorkspaceCommandAssertion(
    workspaceRoot,
    command,
    "Lint check passed with zero errors.",
    "Lint check failed.",
  );
}

async function runTypeSafetyAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; type-safety check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const files = collectWorkspaceSourceFiles(workspaceRoot).filter((file) =>
    file.relativePath.endsWith(".ts") || file.relativePath.endsWith(".tsx"),
  );
  if (files.length === 0) {
    return {
      passed: true,
      message: "No TypeScript sources detected; type-safety check skipped.",
      details: { workspaceRoot, scannedFiles: 0 },
    };
  }

  const findings = collectWorkspaceLineFindings(workspaceRoot, [
    { kind: "explicit_any", regex: /\b(?:as any|<any>|:\s*any\b)/ },
    { kind: "ts_ignore", regex: /@ts-(?:ignore|nocheck)/ },
  ]).filter((finding) => finding.file.endsWith(".ts") || finding.file.endsWith(".tsx"));
  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No obvious type-safety escapes detected in TypeScript sources."
      : "Type-safety escapes detected in TypeScript sources.",
    details: {
      workspaceRoot,
      findings: findings.slice(0, 10),
    },
  };
}

async function runFocusedFunctionsAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; focused-function check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const findings = collectLongFunctionFindings(workspaceRoot);
  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No oversized functions detected in workspace sources."
      : "Oversized functions detected in workspace sources.",
    details: {
      workspaceRoot,
      findings: findings.slice(0, 10),
    },
  };
}

async function runDeepNestingAssertion(
  root: string | undefined,
  config: ScenarioProductionConfig,
) {
  const workspaceRoot = resolveRootPath(root) ?? DEFAULT_WORKSPACE_ROOT;
  if (!directoryExists(workspaceRoot)) {
    return {
      passed: true,
      message: "Workspace root unavailable; deep-nesting check skipped.",
      details: { workspaceRoot, thresholds: config.thresholds },
    };
  }

  const findings = collectDeepNestingFindings(workspaceRoot);
  const passed = findings.length === 0;
  return {
    passed,
    message: passed
      ? "No deeply nested control flow detected in workspace sources."
      : "Deeply nested control flow detected in workspace sources.",
    details: {
      workspaceRoot,
      findings: findings.slice(0, 10),
    },
  };
}

function scanWorkspaceForSecrets(root: string): {
  findings: Array<{ file: string; line: number; kind: string; excerpt: string }>;
  scannedFiles: number;
  totalFindings: number;
} {
  const findings: Array<{ file: string; line: number; kind: string; excerpt: string }> = [];
  let scannedFiles = 0;
  let totalFindings = 0;

  for (const filePath of listWorkspaceFiles(root)) {
    const text = safeReadTextFile(filePath);
    if (text === null) {
      continue;
    }

    scannedFiles += 1;
    const relativePath = relative(root, filePath) || basename(filePath);
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const matches = detectSecretsInLine(line);
      if (matches.length === 0) {
        continue;
      }

      totalFindings += matches.length;
      if (findings.length >= 10) {
        continue;
      }

      for (const kind of matches) {
        findings.push({
          file: relativePath,
          line: index + 1,
          kind,
          excerpt: truncateText(line.trim(), 180),
        });
        if (findings.length >= 10) {
          break;
        }
      }
    }
  }

  return { findings, scannedFiles, totalFindings };
}

function detectSecretsInLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || referencesEnvironment(trimmed)) {
    return [];
  }

  const findings = new Set<string>();
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(trimmed)) {
      findings.add(pattern.kind);
    }
  }

  GENERIC_SECRET_ASSIGNMENT.lastIndex = 0;
  let match = GENERIC_SECRET_ASSIGNMENT.exec(trimmed);
  while (match) {
    const rawValue = (match[2] ?? "").trim();
    if (!isPlaceholderSecretValue(rawValue)) {
      findings.add("generic_secret_assignment");
    }
    match = GENERIC_SECRET_ASSIGNMENT.exec(trimmed);
  }

  return Array.from(findings);
}

function collectWorkspaceQualityFiles(root: string): WorkspaceQualityFile[] {
  const files: WorkspaceQualityFile[] = [];

  for (const filePath of listWorkspaceFiles(root)) {
    if (!isQualityRelevantPath(filePath)) {
      continue;
    }
    const text = safeReadTextFile(filePath);
    if (text === null) {
      continue;
    }
    files.push({
      relativePath: relative(root, filePath) || basename(filePath),
      text,
      lineCount: text.split(/\r?\n/).length,
    });
  }

  return files;
}

function collectWorkspaceSourceFiles(root: string): WorkspaceQualityFile[] {
  return collectWorkspaceQualityFiles(root).filter((file) =>
    SOURCE_SCAN_EXTENSIONS.has(extname(file.relativePath).toLowerCase()),
  );
}

function isQualityRelevantPath(filePath: string): boolean {
  const fileName = basename(filePath).toLowerCase();
  return QUALITY_SCAN_FILENAMES.has(fileName) || QUALITY_SCAN_EXTENSIONS.has(extname(fileName));
}

function collectWorkspaceLineFindings(
  root: string,
  patterns: Array<{ kind: string; regex: RegExp }>,
): Array<{ file: string; line: number; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; line: number; kind: string; excerpt: string }> = [];

  for (const file of collectWorkspaceQualityFiles(root)) {
    const lines = file.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        if (!pattern.regex.test(trimmed)) {
          continue;
        }
        findings.push({
          file: file.relativePath,
          line: index + 1,
          kind: pattern.kind,
          excerpt: truncateText(trimmed, 180),
        });
        if (findings.length >= 25) {
          return findings;
        }
      }
    }
  }

  return findings;
}

function collectWorkspaceFileFindings(
  root: string,
): Array<{ file: string; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; kind: string; excerpt: string }> = [];

  for (const filePath of listWorkspaceFiles(root)) {
    const relativePath = relative(root, filePath) || basename(filePath);
    for (const pattern of DEBUG_FILE_PATTERNS) {
      if (!pattern.regex.test(relativePath)) {
        continue;
      }
      findings.push({
        file: relativePath,
        kind: pattern.kind,
        excerpt: relativePath,
      });
      if (findings.length >= 25) {
        return findings;
      }
    }
  }

  return findings;
}

async function runWorkspaceCommandAssertion(
  workspaceRoot: string,
  command: string,
  successMessage: string,
  failureMessage: string,
) {
  try {
    const result = await execFileAsync("/bin/bash", ["-lc", command], {
      cwd: workspaceRoot,
      env: process.env,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      passed: true,
      message: successMessage,
      details: {
        command,
        workspaceRoot,
        output: summarizeCommandOutput(result.stdout, result.stderr),
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: failureMessage,
      details: {
        command,
        workspaceRoot,
        error: formatExecError(error),
      },
    };
  }
}

function resolveCompilerCommand(workspaceRoot: string): string | null {
  const packageJson = readWorkspacePackageJson(workspaceRoot);
  if (packageJson?.scripts?.typecheck) {
    return packageManagerScriptCommand(workspaceRoot, "typecheck");
  }
  if (packageJson?.scripts?.["check-types"]) {
    return packageManagerScriptCommand(workspaceRoot, "check-types");
  }
  if (packageJson && fileExists(join(workspaceRoot, "tsconfig.json"))) {
    return packageManagerExecCommand(workspaceRoot, "tsc --noEmit");
  }
  if (collectWorkspaceSourceFiles(workspaceRoot).some((file) => file.relativePath.endsWith(".py"))) {
    return "python3 -m compileall -q .";
  }
  return null;
}

function resolveLintCommand(workspaceRoot: string): string | null {
  const packageJson = readWorkspacePackageJson(workspaceRoot);
  if (packageJson?.scripts?.lint) {
    return packageManagerScriptCommand(workspaceRoot, "lint");
  }
  if (packageJson && hasEslintConfig(workspaceRoot)) {
    return packageManagerExecCommand(workspaceRoot, "eslint . --max-warnings 0");
  }
  if (hasRuffConfig(workspaceRoot) && toolAvailable("ruff")) {
    return "ruff check .";
  }
  return null;
}

function readWorkspacePackageJson(
  workspaceRoot: string,
): { scripts?: Record<string, string> } | null {
  const raw = safeRead(join(workspaceRoot, "package.json"));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as { scripts?: Record<string, string> };
  } catch {
    return null;
  }
}

function packageManagerScriptCommand(workspaceRoot: string, script: string): string {
  const packageManager = detectPackageManager(workspaceRoot);
  if (packageManager === "pnpm") {
    return `pnpm ${script}`;
  }
  if (packageManager === "yarn") {
    return `yarn ${script}`;
  }
  return `npm run ${script}`;
}

function packageManagerExecCommand(workspaceRoot: string, command: string): string {
  const packageManager = detectPackageManager(workspaceRoot);
  if (packageManager === "pnpm") {
    return `pnpm exec ${command}`;
  }
  if (packageManager === "yarn") {
    return `yarn exec ${command}`;
  }
  return `npm exec -- ${command}`;
}

function detectPackageManager(workspaceRoot: string): "pnpm" | "yarn" | "npm" {
  if (fileExists(join(workspaceRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fileExists(join(workspaceRoot, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

function hasEslintConfig(workspaceRoot: string): boolean {
  return [
    "eslint.config.js",
    "eslint.config.mjs",
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
  ].some((name) => fileExists(join(workspaceRoot, name)));
}

function hasRuffConfig(workspaceRoot: string): boolean {
  if (fileExists(join(workspaceRoot, "ruff.toml")) || fileExists(join(workspaceRoot, ".ruff.toml"))) {
    return true;
  }
  const pyproject = safeRead(join(workspaceRoot, "pyproject.toml"));
  return Boolean(pyproject?.includes("[tool.ruff"));
}

function toolAvailable(tool: string): boolean {
  try {
    execFileSync("/bin/bash", ["-lc", `command -v ${tool} >/dev/null 2>&1`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function collectLongFunctionFindings(
  root: string,
): Array<{ file: string; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; kind: string; excerpt: string }> = [];

  for (const file of collectWorkspaceSourceFiles(root)) {
    const extension = extname(file.relativePath).toLowerCase();
    const lines = file.text.split(/\r?\n/);
    if (extension === ".py") {
      findings.push(...collectLongPythonFunctions(file.relativePath, lines));
    } else {
      findings.push(...collectLongBraceFunctions(file.relativePath, lines));
    }
    if (findings.length >= 25) {
      return findings;
    }
  }

  return findings;
}

function collectLongPythonFunctions(
  file: string,
  lines: string[],
): Array<{ file: string; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; kind: string; excerpt: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!/^\s*(async\s+def|def)\s+\w+\s*\(/.test(line)) {
      continue;
    }
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    let end = index + 1;
    while (end < lines.length) {
      const current = lines[end] ?? "";
      if (current.trim().length === 0) {
        end += 1;
        continue;
      }
      const currentIndent = current.match(/^\s*/)?.[0].length ?? 0;
      if (currentIndent <= indent) {
        break;
      }
      end += 1;
    }
    const lineCount = end - index;
    if (lineCount > 80) {
      findings.push({
        file,
        kind: "long_function",
        excerpt: `${truncateText(line.trim(), 120)} (${lineCount} lines)`,
      });
    }
  }
  return findings;
}

function collectLongBraceFunctions(
  file: string,
  lines: string[],
): Array<{ file: string; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; kind: string; excerpt: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (
      !/^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/.test(line) &&
      !/^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/.test(line)
    ) {
      continue;
    }
    let braceDepth = 0;
    let seenOpeningBrace = false;
    let end = index;
    while (end < lines.length) {
      const current = lines[end] ?? "";
      braceDepth += countChar(current, "{");
      braceDepth -= countChar(current, "}");
      if (countChar(current, "{") > 0) {
        seenOpeningBrace = true;
      }
      if (seenOpeningBrace && braceDepth <= 0 && end > index) {
        break;
      }
      end += 1;
    }
    const lineCount = end - index + 1;
    if (seenOpeningBrace && lineCount > 80) {
      findings.push({
        file,
        kind: "long_function",
        excerpt: `${truncateText(line.trim(), 120)} (${lineCount} lines)`,
      });
    }
  }
  return findings;
}

function collectDeepNestingFindings(
  root: string,
): Array<{ file: string; kind: string; excerpt: string }> {
  const findings: Array<{ file: string; kind: string; excerpt: string }> = [];
  for (const file of collectWorkspaceSourceFiles(root)) {
    const extension = extname(file.relativePath).toLowerCase();
    const lines = file.text.split(/\r?\n/);
    if (extension === ".py") {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const indent = Math.floor((line.match(/^\s*/)?.[0].length ?? 0) / 4);
        if (indent > 4) {
          findings.push({
            file: file.relativePath,
            kind: "deep_nesting",
            excerpt: truncateText(trimmed, 120),
          });
          break;
        }
      }
      continue;
    }

    let depth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      depth += countChar(line, "{");
      if (depth > 4) {
        findings.push({
          file: file.relativePath,
          kind: "deep_nesting",
          excerpt: truncateText(trimmed, 120),
        });
        break;
      }
      depth -= countChar(line, "}");
      depth = Math.max(0, depth);
    }
  }
  return findings;
}

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

function listWorkspaceFiles(root: string): string[] {
  const files: string[] = [];

  const visit = (current: string) => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_SCAN_DIRS.has(entry.name)) {
          continue;
        }
        visit(join(current, entry.name));
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push(join(current, entry.name));
    }
  };

  visit(root);
  return files;
}

function hashWorkspaceState(root: string): { hash: string; fileCount: number; skippedFiles: number } {
  const hash = createHash("sha256");
  let fileCount = 0;
  let skippedFiles = 0;

  for (const filePath of listWorkspaceFiles(root)) {
    const content = safeReadBinaryFile(filePath);
    if (content === null) {
      skippedFiles += 1;
      continue;
    }

    hash.update(relative(root, filePath));
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    fileCount += 1;
  }

  return {
    hash: hash.digest("hex"),
    fileCount,
    skippedFiles,
  };
}

function safeReadTextFile(path: string): string | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) {
      return null;
    }

    const content = readFileSync(path);
    if (looksBinary(content)) {
      return null;
    }

    return content.toString("utf8");
  } catch {
    return null;
  }
}

function safeReadBinaryFile(path: string): Buffer | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) {
      return null;
    }

    const content = readFileSync(path);
    return looksBinary(content) ? null : content;
  } catch {
    return null;
  }
}

function looksBinary(content: Buffer): boolean {
  const sampleLength = Math.min(content.length, 1024);
  for (let index = 0; index < sampleLength; index += 1) {
    if (content[index] === 0) {
      return true;
    }
  }
  return false;
}

function collectMatchingLines(text: string, matcher: (line: string) => boolean): string[] {
  const matches: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !matcher(trimmed)) {
      continue;
    }

    matches.push(truncateText(trimmed, 160));
    if (matches.length >= 5) {
      break;
    }
  }

  return matches;
}

function isIdempotencyFailureLine(line: string): boolean {
  const normalized = line.toLowerCase();
  if (normalized.includes("if not exists")) {
    return false;
  }

  return (
    normalized.includes("duplicate key") ||
    normalized.includes("duplicate row") ||
    normalized.includes("duplicate rows") ||
    normalized.includes("violates unique constraint") ||
    normalized.includes("non-idempotent") ||
    normalized.includes("already exists") ||
    normalized.includes("primary key constraint")
  );
}

function isIdempotencySignalLine(line: string): boolean {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("idempotent") ||
    normalized.includes("rerun") ||
    normalized.includes("re-run") ||
    normalized.includes("upsert") ||
    normalized.includes("dedup") ||
    normalized.includes("merge") ||
    normalized.includes("truncate") ||
    normalized.includes("on conflict") ||
    normalized.includes("if not exists")
  );
}

function referencesEnvironment(line: string): boolean {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("process.env") ||
    normalized.includes("ctx.env(") ||
    normalized.includes("os.environ") ||
    normalized.includes("getenv(") ||
    normalized.includes("${") ||
    normalized.includes("$env:")
  );
}

function isPlaceholderSecretValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("example") ||
    normalized.includes("placeholder") ||
    normalized.includes("dummy") ||
    normalized.includes("changeme") ||
    normalized.includes("replace-me") ||
    normalized.includes("redacted") ||
    normalized.includes("localhost") ||
    normalized.includes("test") ||
    normalized.includes("sample") ||
    normalized.includes("fake") ||
    normalized === "password"
  );
}

function resolveRootPath(root: string | undefined): string | null {
  const trimmed = root?.trim();
  return trimmed ? trimmed : null;
}

function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function summarizeCommandOutput(stdout: string | Buffer, stderr: string | Buffer) {
  const combined = `${stdout.toString()}${stderr.toString()}`.trim();
  return truncateText(combined, 240);
}

function formatExecError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}
