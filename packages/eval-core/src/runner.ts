import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";

import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@dec-bench/scenarios";

import type { AssertionContext } from "./context.js";
import { loadScenarioAssertions, type AssertionFn } from "./discovery.js";
import type {
  AssertionLogMap,
  AssertionLogOutput,
  EvalOutput,
  GateName,
  GateResult,
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
  let scoreSum = 0;

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

    scoreSum += scenarioScore;
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
      normalizedScore: clamp(scoreSum / GATES.length),
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
        const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
        const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
        const passed = hasPostgres && hasClickHouse;
        return {
          passed,
          message: passed
            ? "Required data store environment variables are available."
            : "Missing required data store environment variables.",
          details: {
            hasPostgresUrl: hasPostgres,
            hasClickhouseUrl: hasClickHouse,
          },
        };
      },
      no_secrets_in_code: async () =>
        runSecretScanAssertion(options.secretScanRoot ?? options.workspaceRoot),
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
