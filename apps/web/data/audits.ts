import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import type { EvalResult, GateName, GateResult } from "./results";

export type AuditLogKind = "stdout" | "stderr" | "service" | "system" | "trace" | "custom";
export type AuditCompression = "none" | "gzip";

export interface AuditRunMetadata {
  persona: string;
  planMode: string;
  promptPath: string;
  promptSha256: string;
  promptContent: string;
  promptPreview?: string;
}

export interface AuditTraceSummary {
  agentSteps: number;
  toolCallCount: number;
  toolResultCount?: number;
  thinkingCount: number;
  assistantTextCount?: number;
  eventCount: number;
}

export interface AuditTraceEvent {
  id: string;
  kind: string;
  role?: string;
  name?: string;
  content?: string;
  [key: string]: unknown;
}

export interface AuditTracePayload {
  schemaVersion: string;
  source: string;
  summary?: AuditTraceSummary;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalCostUsd?: number;
  };
  events?: AuditTraceEvent[];
}

function normalizeTraceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => normalizeTraceText(item)).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  const maybeText = (value as { text?: unknown }).text;
  if (typeof maybeText === "string") return maybeText;
  const maybeContent = (value as { content?: unknown }).content;
  if (typeof maybeContent === "string") return maybeContent;
  if (Array.isArray(maybeContent)) return normalizeTraceText(maybeContent);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const CURSOR_BENCH_SYSTEM_PROMPT_PREFIX =
  "You are running inside a sandboxed Docker container for a benchmark evaluation.";

function splitCursorBenchSystemPrompt(text: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(CURSOR_BENCH_SYSTEM_PROMPT_PREFIX)) {
    return {
      systemPrompt: "",
      userPrompt: text,
    };
  }

  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx < 0) {
    return {
      systemPrompt: "",
      userPrompt: text,
    };
  }
  const systemPrompt = trimmed.slice(0, splitIdx).trim();
  const userPrompt = trimmed.slice(splitIdx + 2).trimStart();
  if (systemPrompt.length === 0) {
    return {
      systemPrompt: "",
      userPrompt: text,
    };
  }
  return {
    systemPrompt,
    userPrompt: userPrompt.length > 0 ? userPrompt : text,
  };
}

function extractTraceMessageText(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  const maybeText = (message as { text?: unknown }).text;
  if (typeof maybeText === "string") return maybeText;
  const maybeContent = (message as { content?: unknown }).content;
  if (typeof maybeContent === "string") return maybeContent;
  if (Array.isArray(maybeContent)) {
    const chunks: string[] = [];
    for (const block of maybeContent) {
      if (!block || typeof block !== "object") continue;
      const blockText = (block as { text?: unknown }).text;
      if (typeof blockText === "string") {
        chunks.push(blockText);
        continue;
      }
      const blockContent = (block as { content?: unknown }).content;
      if (typeof blockContent === "string") chunks.push(blockContent);
    }
    if (chunks.length > 0) return chunks.join("\n");
  }
  return normalizeTraceText(message);
}

function normalizeCursorToolName(toolCall: unknown): string | null {
  if (!toolCall || typeof toolCall !== "object") return null;
  const firstKey = Object.keys(toolCall)[0];
  if (!firstKey) return null;
  return firstKey.replace(/ToolCall$/, "") || firstKey;
}

function normalizeCursorToolArgs(toolCall: unknown): Record<string, unknown> | null {
  if (!toolCall || typeof toolCall !== "object") return null;
  const first = Object.values(toolCall)[0];
  if (!first || typeof first !== "object") return null;
  const args = (first as { args?: unknown }).args;
  return args && typeof args === "object" ? (args as Record<string, unknown>) : null;
}

function normalizeCursorToolResult(
  toolCall: unknown,
): { content: string; isError: boolean } {
  if (!toolCall || typeof toolCall !== "object") {
    return { content: "", isError: false };
  }
  const first = Object.values(toolCall)[0];
  if (!first || typeof first !== "object") {
    return { content: "", isError: false };
  }
  const result = (first as { result?: unknown }).result;
  if (!result || typeof result !== "object") {
    return { content: "", isError: false };
  }
  const resultRecord = result as Record<string, unknown>;
  let content = "";
  let isError = false;

  const success = resultRecord.success;
  if (success && typeof success === "object") {
    const successRecord = success as Record<string, unknown>;
    const stdout = normalizeTraceText(
      successRecord.stdout ??
        successRecord.interleavedOutput ??
        successRecord.content ??
        "",
    );
    const stderr = normalizeTraceText(successRecord.stderr ?? "");
    content = [stdout, stderr].filter((part) => part.trim().length > 0).join("\n");
  }

  if (resultRecord.error !== undefined) {
    isError = true;
    const errorText = normalizeTraceText(resultRecord.error);
    content = [content, errorText].filter((part) => part.trim().length > 0).join("\n");
  }

  if (!content) {
    content = normalizeTraceText(resultRecord);
  }

  return { content, isError };
}

function normalizeCursorTrace(trace: AuditTracePayload): AuditTracePayload {
  const events = trace.events ?? [];
  if (events.length === 0) return trace;

  const normalizedEvents = events
    .flatMap((event) => {
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    const payloadType =
      payload && typeof payload.type === "string" ? payload.type : event.kind;
    const payloadTs = payload?.timestamp_ms;
    const timestamp =
      typeof event.timestamp === "string"
        ? event.timestamp
        : typeof payloadTs === "number" && Number.isFinite(payloadTs)
          ? new Date(payloadTs).toISOString()
          : event.timestamp;

    if (payloadType === "user") {
      const content =
        event.content ?? extractTraceMessageText(payload?.message ?? payload?.content);
      if (typeof content !== "string") {
        return [
          {
            ...event,
            kind: "user_message",
            role: "user",
            timestamp,
            content,
          },
        ];
      }
      const parsed = splitCursorBenchSystemPrompt(content);
      const mapped: AuditTraceEvent[] = [];
      if (parsed.systemPrompt.trim().length > 0) {
        mapped.push({
          ...event,
          id: `${event.id}.system`,
          kind: "system_message",
          role: "system",
          timestamp,
          content: parsed.systemPrompt,
        });
      }
      mapped.push({
        ...event,
        id: `${event.id}.user`,
        kind: "user_message",
        role: "user",
        timestamp,
        content: parsed.userPrompt,
      });
      return mapped;
    }

    if (payloadType === "assistant") {
      const content =
        event.content ?? extractTraceMessageText(payload?.message ?? payload?.content);
      if (typeof content === "string" && content.trim().length === 0) return [];
      return [
        {
          ...event,
          kind: "assistant_text",
          role: "assistant",
          timestamp,
          content,
        },
      ];
    }

    if (payloadType === "thinking") {
      const content = event.content ?? normalizeTraceText(payload?.text ?? payload?.message ?? "");
      if (typeof content === "string" && content.trim().length === 0) return [];
      return [
        {
          ...event,
          kind: "thinking",
          role: "assistant",
          timestamp,
          content,
        },
      ];
    }

    if (payloadType === "tool_call") {
      const subtype = typeof payload?.subtype === "string" ? payload.subtype : "";
      const toolCall = payload?.tool_call;
      const toolName = normalizeCursorToolName(toolCall);
      const toolUseId =
        typeof payload?.call_id === "string" ? payload.call_id : event.toolUseId;
      if (subtype === "started") {
        const args = normalizeCursorToolArgs(toolCall);
        return [
          {
            ...event,
            kind: "tool_use",
            role: "assistant",
            timestamp,
            name: event.name ?? toolName ?? undefined,
            toolName: event.toolName ?? toolName ?? undefined,
            toolUseId,
            input: event.input ?? args ?? undefined,
            content:
              event.content ??
              normalizeTraceText(
                args?.description ?? args?.command ?? args?.path ?? args ?? "",
              ),
          },
        ];
      }
      const result = normalizeCursorToolResult(toolCall);
      return [
        {
          ...event,
          kind: "tool_result",
          role: "tool",
          timestamp,
          toolName: event.toolName ?? toolName ?? undefined,
          toolUseId,
          isError: event.isError ?? result.isError,
          content: event.content ?? result.content,
        },
      ];
    }

    if (payloadType === "result") {
      return [
        {
          ...event,
          kind: "assistant_final",
          role: "assistant",
          timestamp,
          isError:
            event.isError ??
            (typeof payload?.is_error === "boolean" ? payload.is_error : false),
          content:
            event.content ??
            normalizeTraceText(payload?.result ?? payload?.message ?? payload?.text ?? ""),
        },
      ];
    }

    if (payloadType === "system") {
      return [
        {
          ...event,
          kind: "event",
          role: "system",
          timestamp,
          content:
            event.content ??
            normalizeTraceText(payload?.subtype ?? payload?.message ?? "system event"),
        },
      ];
    }

    return [{ ...event, timestamp }];
  });

  return {
    ...trace,
    events: normalizedEvents,
  };
}

export interface AssertionLog {
  passed: boolean;
  durationMs: number;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export type AssertionLogMap = Record<string, AssertionLog>;

export type AssertionLogOutput = Record<
  GateName,
  {
    core: AssertionLogMap;
    scenario: AssertionLogMap;
  }
>;

export interface AuditLogReference {
  id: string;
  label: string;
  kind: AuditLogKind;
  relativePath: string;
  bytes: number;
  compression: AuditCompression;
}

export interface AuditRunManifest {
  schemaVersion: "1";
  runId: string;
  scenario: string;
  timestamp: string;
  harness: string;
  agent: string;
  model: string;
  version: string;
  runMetadata?: AuditRunMetadata;
  highestGate: number;
  normalizedScore: number;
  efficiency: EvalResult["efficiency"];
  gates: Record<GateName, GateResult>;
  logs: AuditLogReference[];
  traceSummary?: AuditTraceSummary;
  notes?: string[];
}

export interface ScenarioRunIndexEntry {
  runId: string;
  scenario: string;
  timestamp: string;
  harness: string;
  agent: string;
  model: string;
  version: string;
  highestGate: number;
  normalizedScore: number;
  availableLogs: number;
}

export interface ScenarioAuditIndex {
  schemaVersion: "1";
  scenario: string;
  runs: ScenarioRunIndexEntry[];
}

export interface ScenarioTask {
  id: string;
  description: string;
  category: string;
}

export interface ScenarioInfrastructure {
  services: string[];
  description?: string;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  tier: string;
  domain: string;
  harness: string;
  tasks: ScenarioTask[];
  personaPrompts?: Record<string, string>;
  tags?: string[];
  infrastructure?: ScenarioInfrastructure;
}

export interface ScenarioPromptContent {
  persona: string;
  path: string;
  content: string;
}

export interface AuditScenarioContext {
  id: string;
  title: string;
  description: string;
  tier: string;
  domain: string;
  harness: string;
  tags: string[];
  tasks: ScenarioTask[];
  infrastructure?: ScenarioInfrastructure;
  prompts: ScenarioPromptContent[];
}

function resolveAuditsDir(): string {
  const explicitDir = process.env.DEC_BENCH_AUDITS_DIR;
  if (explicitDir && existsSync(explicitDir)) return explicitDir;

  const runtimeResultsDir = join(process.cwd(), "..", "..", "results");
  if (existsSync(runtimeResultsDir)) {
    return join(runtimeResultsDir, "audits");
  }

  const useSampleData = process.env.DEC_BENCH_USE_SAMPLE_DATA === "1";
  if (!useSampleData) {
    return join(runtimeResultsDir, "audits");
  }

  const localDir = join(process.cwd(), "data", "audits");
  if (existsSync(localDir)) return localDir;

  return join(process.cwd(), "apps", "web", "data", "audits");
}

function resolveScenarioSourcesDir(): string {
  const localDir = join(process.cwd(), "scenarios");
  if (existsSync(localDir)) return localDir;

  return join(process.cwd(), "..", "..", "scenarios");
}

function safeParseJson<T>(path: string): T | null {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isSafeSegment(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}

function toCompression(value: string | undefined): AuditCompression {
  return value === "gzip" ? "gzip" : "none";
}

function validateRelativePath(path: string): boolean {
  if (!path || path.includes("\0") || path.startsWith("/")) return false;
  return !path.split("/").some((part) => part === "..");
}

function normalizeLogReference(
  runDir: string,
  raw: Partial<AuditLogReference>,
  index: number,
): AuditLogReference | null {
  const fallbackPath = index === 0 ? "stdout.log" : `logs/log-${index + 1}.log`;
  const relativePath = raw.relativePath ?? fallbackPath;
  if (!validateRelativePath(relativePath)) return null;

  const absolutePath = resolve(runDir, relativePath);
  const bytes = raw.bytes ?? (existsSync(absolutePath) ? statSync(absolutePath).size : 0);

  return {
    id: raw.id?.trim() || `log-${index + 1}`,
    label: raw.label?.trim() || `Log ${index + 1}`,
    kind: raw.kind ?? (index === 0 ? "stdout" : "custom"),
    relativePath,
    bytes: Math.max(0, Number(bytes) || 0),
    compression: toCompression(raw.compression),
  };
}

function coerceManifest(path: string, data: Record<string, unknown>): AuditRunManifest | null {
  const runDir = resolve(path, "..");
  const runId = String(data.runId ?? "").trim();
  const scenario = String(data.scenario ?? "").trim();
  if (!runId || !scenario || !isSafeSegment(runId) || !isSafeSegment(scenario)) return null;

  const gates = data.gates as Record<GateName, GateResult> | undefined;
  const efficiency = data.efficiency as EvalResult["efficiency"] | undefined;
  if (!gates || !efficiency) return null;

  const rawLogs = Array.isArray(data.logs) ? (data.logs as Partial<AuditLogReference>[]) : [];
  const logs = rawLogs
    .map((entry, index) => normalizeLogReference(runDir, entry, index))
    .filter((entry): entry is AuditLogReference => Boolean(entry));

  return {
    schemaVersion: "1",
    runId,
    scenario,
    timestamp: String(data.timestamp ?? ""),
    harness: String(data.harness ?? "unknown"),
    agent: String(data.agent ?? "unknown"),
    model: String(data.model ?? "unknown"),
    version: String(data.version ?? "unknown"),
    runMetadata:
      data.runMetadata && typeof data.runMetadata === "object"
        ? (data.runMetadata as AuditRunMetadata)
        : undefined,
    highestGate: Number(data.highestGate ?? 0),
    normalizedScore: Number(data.normalizedScore ?? 0),
    efficiency,
    gates,
    logs,
    traceSummary:
      data.traceSummary && typeof data.traceSummary === "object"
        ? (data.traceSummary as AuditTraceSummary)
        : undefined,
    notes: Array.isArray(data.notes)
      ? (data.notes.filter((value): value is string => typeof value === "string") as string[])
      : [],
  };
}

function sortRunsDesc<T extends { timestamp: string }>(runs: T[]): T[] {
  return [...runs].sort((a, b) => {
    const left = Date.parse(a.timestamp);
    const right = Date.parse(b.timestamp);
    if (!Number.isNaN(left) && !Number.isNaN(right)) return right - left;
    return b.timestamp.localeCompare(a.timestamp);
  });
}

export function listAuditScenarios(): string[] {
  const auditsDir = resolveAuditsDir();
  if (!existsSync(auditsDir)) return [];

  return readdirSync(auditsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeSegment(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function buildScenarioIndexFromManifests(scenario: string): ScenarioAuditIndex | null {
  const auditsDir = resolveAuditsDir();
  const scenarioDir = join(auditsDir, scenario);
  if (!existsSync(scenarioDir)) return null;

  const runs: ScenarioRunIndexEntry[] = [];
  for (const entry of readdirSync(scenarioDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isSafeSegment(entry.name)) continue;
    const manifestPath = join(scenarioDir, entry.name, "manifest.json");
    const raw = safeParseJson<Record<string, unknown>>(manifestPath);
    if (!raw) continue;

    const manifest = coerceManifest(manifestPath, raw);
    if (!manifest || manifest.scenario !== scenario) continue;

    runs.push({
      runId: manifest.runId,
      scenario: manifest.scenario,
      timestamp: manifest.timestamp,
      harness: manifest.harness,
      agent: manifest.agent,
      model: manifest.model,
      version: manifest.version,
      highestGate: manifest.highestGate,
      normalizedScore: manifest.normalizedScore,
      availableLogs: manifest.logs.length,
    });
  }

  return {
    schemaVersion: "1",
    scenario,
    runs: sortRunsDesc(runs),
  };
}

export function getScenarioAuditIndex(scenario: string): ScenarioAuditIndex | null {
  if (!isSafeSegment(scenario)) return null;

  const auditsDir = resolveAuditsDir();
  const indexPath = join(auditsDir, scenario, "index.json");
  const indexed = safeParseJson<ScenarioAuditIndex>(indexPath);
  if (indexed?.schemaVersion === "1" && indexed.scenario === scenario) {
    return {
      ...indexed,
      runs: sortRunsDesc(indexed.runs ?? []),
    };
  }

  return buildScenarioIndexFromManifests(scenario);
}

export function getScenarioAuditRunIds(scenario: string): Set<string> {
  const index = getScenarioAuditIndex(scenario);
  return new Set((index?.runs ?? []).map((run) => run.runId));
}

export function getAuditRunManifest(scenario: string, runId: string): AuditRunManifest | null {
  if (!isSafeSegment(scenario) || !isSafeSegment(runId)) return null;

  const auditsDir = resolveAuditsDir();
  const manifestPath = join(auditsDir, scenario, runId, "manifest.json");
  const raw = safeParseJson<Record<string, unknown>>(manifestPath);
  if (!raw) return null;

  const manifest = coerceManifest(manifestPath, raw);
  if (!manifest || manifest.scenario !== scenario || manifest.runId !== runId) return null;
  return manifest;
}

export function resolveAuditLogPath(
  scenario: string,
  runId: string,
  logId: string,
): { absolutePath: string; log: AuditLogReference } | null {
  const manifest = getAuditRunManifest(scenario, runId);
  if (!manifest) return null;

  const log = manifest.logs.find((entry) => entry.id === logId);
  if (!log || !validateRelativePath(log.relativePath)) return null;

  const runDir = join(resolveAuditsDir(), scenario, runId);
  const absolutePath = resolve(runDir, log.relativePath);
  if (!absolutePath.startsWith(runDir)) return null;
  if (!existsSync(absolutePath)) return null;

  return { absolutePath, log };
}

export interface AuditLogChunk {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export function readAuditLogChunk(
  scenario: string,
  runId: string,
  logId: string,
  startLine: number,
  limit: number,
): AuditLogChunk | null {
  const resolved = resolveAuditLogPath(scenario, runId, logId);
  if (!resolved) return null;

  const raw = readFileSync(resolved.absolutePath, "utf8");
  const lines = raw.split("\n");
  const totalLines = lines.length;
  const safeStart = Math.max(0, startLine);
  const safeLimit = Math.max(1, Math.min(limit, 2000));
  const safeEndExclusive = Math.min(totalLines, safeStart + safeLimit);
  const sliced = lines.slice(safeStart, safeEndExclusive);

  return {
    content: sliced.join("\n"),
    totalLines,
    startLine: safeStart,
    endLine: Math.max(safeStart, safeEndExclusive - 1),
    hasMoreBefore: safeStart > 0,
    hasMoreAfter: safeEndExclusive < totalLines,
  };
}

export function getAuditRunTrace(scenario: string, runId: string): AuditTracePayload | null {
  const manifest = getAuditRunManifest(scenario, runId);
  if (!manifest) return null;
  const traceLog = manifest.logs.find((log) => log.id === "trace");
  if (!traceLog) return null;
  const resolved = resolveAuditLogPath(scenario, runId, traceLog.id);
  if (!resolved) return null;
  try {
    const raw = readFileSync(resolved.absolutePath, "utf8");
    const parsed = JSON.parse(raw) as AuditTracePayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.source === "cursor-stream-json") {
      return normalizeCursorTrace(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

function toAssertionLogMap(raw: unknown): AssertionLogMap {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const output: AssertionLogMap = {};
  for (const [name, value] of entries) {
    if (!value || typeof value !== "object") continue;
    const log = value as Record<string, unknown>;
    const passed = Boolean(log.passed);
    const durationMs = Number(log.durationMs ?? 0);
    output[name] = {
      passed,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      message: typeof log.message === "string" ? log.message : undefined,
      error: typeof log.error === "string" ? log.error : undefined,
      details:
        log.details && typeof log.details === "object"
          ? (log.details as Record<string, unknown>)
          : undefined,
    };
  }
  return output;
}

export function getAssertionLogs(scenario: string, runId: string): AssertionLogOutput | null {
  const manifest = getAuditRunManifest(scenario, runId);
  if (!manifest) return null;
  const assertionLog = manifest.logs.find((log) => log.id === "assertion_log");
  if (!assertionLog) return null;

  const resolved = resolveAuditLogPath(scenario, runId, assertionLog.id);
  if (!resolved) return null;

  try {
    const raw = readFileSync(resolved.absolutePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Record<GateName, unknown>>;
    const gates: GateName[] = ["functional", "correct", "robust", "performant", "production"];
    const output = {} as AssertionLogOutput;
    for (const gate of gates) {
      const gateValue = parsed?.[gate];
      if (!gateValue || typeof gateValue !== "object") {
        output[gate] = { core: {}, scenario: {} };
        continue;
      }
      const gateRecord = gateValue as Record<string, unknown>;
      output[gate] = {
        core: toAssertionLogMap(gateRecord.core),
        scenario: toAssertionLogMap(gateRecord.scenario),
      };
    }
    return output;
  } catch {
    return null;
  }
}

export interface AssertionSourceMap {
  scenario: Record<GateName, string | null>;
  core: string;
}

const CORE_ASSERTION_SOURCE: Record<string, string> = {
  process_exits_clean: `async function process_exits_clean(): Promise<AssertionResult> {
  return {
    passed: processExitCode === 0,
    message: processExitCode === 0
      ? "Agent process exited cleanly."
      : \`Agent process exited with code \${processExitCode}.\`,
    details: { exitCode: processExitCode },
  };
}`,
  no_unhandled_errors: `async function no_unhandled_errors(): Promise<AssertionResult> {
  if (!sessionLogPath) {
    return {
      passed: true,
      message: "Session log path unavailable; unhandled error scan skipped.",
    };
  }
  const sessionLog = safeRead(sessionLogPath);
  if (!sessionLog) {
    return {
      passed: true,
      message: "Session log missing or unreadable; unhandled error scan skipped.",
      details: { sessionLogPath },
    };
  }
  const passed = !/unhandled|traceback|panic:/i.test(sessionLog);
  return {
    passed,
    message: passed
      ? "No unhandled errors, tracebacks, or panics found in session log."
      : "Unhandled error indicators found in session log.",
    details: { sessionLogPath },
  };
}`,
  idempotent_rerun: `async function idempotent_rerun(): Promise<AssertionResult> {
  return {
    passed: true,
    message: "Idempotent rerun check is currently a placeholder assertion.",
  };
}`,
  uses_env_vars: `async function uses_env_vars(ctx: AssertionContext): Promise<AssertionResult> {
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
}`,
  no_secrets_in_code: `async function no_secrets_in_code(): Promise<AssertionResult> {
  return {
    passed: true,
    message: "Secret scanning assertion is currently a placeholder.",
  };
}`,
};

export function getCoreAssertionSource(name: string): string | null {
  return CORE_ASSERTION_SOURCE[name] ?? null;
}

export function getAssertionSources(scenarioId: string): AssertionSourceMap {
  const gates: GateName[] = ["functional", "correct", "robust", "performant", "production"];
  const gateFiles: Record<GateName, string> = {
    functional: "functional.ts",
    correct: "correct.ts",
    robust: "robust.ts",
    performant: "performant.ts",
    production: "production.ts",
  };

  const sourcesDir = resolveScenarioSourcesDir();
  const assertionsDir = join(sourcesDir, scenarioId, "assertions");

  const scenario = {} as Record<GateName, string | null>;
  for (const gate of gates) {
    const filePath = join(assertionsDir, gateFiles[gate]);
    if (existsSync(filePath)) {
      try {
        scenario[gate] = readFileSync(filePath, "utf8");
      } catch {
        scenario[gate] = null;
      }
    } else {
      scenario[gate] = null;
    }
  }

  const coreLines = Object.values(CORE_ASSERTION_SOURCE).join("\n\n");
  return { scenario, core: coreLines };
}

export function getScenarioAuditContext(scenarioId: string): AuditScenarioContext | null {
  if (!isSafeSegment(scenarioId)) return null;

  const sourcesDir = resolveScenarioSourcesDir();
  const scenarioDir = join(sourcesDir, scenarioId);
  const scenarioPath = join(scenarioDir, "scenario.json");
  const scenario = safeParseJson<ScenarioDefinition>(scenarioPath);
  if (!scenario || scenario.id !== scenarioId) return null;

  const prompts: ScenarioPromptContent[] = [];
  for (const [persona, promptPath] of Object.entries(scenario.personaPrompts ?? {})) {
    if (!validateRelativePath(promptPath)) continue;
    const absolutePromptPath = resolve(scenarioDir, promptPath);
    if (!absolutePromptPath.startsWith(scenarioDir)) continue;
    if (!existsSync(absolutePromptPath)) continue;
    prompts.push({
      persona,
      path: promptPath,
      content: readFileSync(absolutePromptPath, "utf8"),
    });
  }

  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    tier: scenario.tier,
    domain: scenario.domain,
    harness: scenario.harness,
    tags: scenario.tags ?? [],
    tasks: scenario.tasks ?? [],
    infrastructure: scenario.infrastructure,
    prompts,
  };
}
