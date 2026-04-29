import Anthropic from "@anthropic-ai/sdk";

import type { AssertionContext } from "./context.js";
import type { AssertionFn } from "./discovery.js";
import type { AssertionResult } from "./types.js";
import {
  resolveJudgeInputs,
  type JudgeInputName,
  type JudgeInputBundle,
} from "./judge-inputs.js";

export type JudgeToolName = "clickhouse-readonly" | "pg-readonly" | "http-get";

export interface LlmJudgeConfig {
  rubric: string;
  inputs?: JudgeInputName[];
  tools?: JudgeToolName[];
  model?: string;
  samples?: number;
  maxTurns?: number;
  inputBundle?: () => JudgeInputBundle;
}

export interface JudgeVerdict {
  passed: boolean;
  reasoning: string;
  categories?: string[];
}

export interface JudgeRunDetails {
  model: string;
  samples: number;
  verdicts: JudgeVerdict[];
  tokens: { input: number; output: number };
  durationMs: number;
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  error?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TURNS = 6;
const DEFAULT_SAMPLES = 1;
const HTTP_GET_MAX_BYTES = 16_000;

type AnthropicClient = InstanceType<typeof Anthropic>;

interface InternalDeps {
  createClient?: (apiKey: string) => AnthropicClient;
}

export function llmJudge(config: LlmJudgeConfig, deps: InternalDeps = {}): AssertionFn {
  const inputs = config.inputs ?? ["sessionLog"];
  const tools = config.tools ?? [];
  const model = config.model ?? DEFAULT_MODEL;
  const samples = Math.max(1, config.samples ?? DEFAULT_SAMPLES);
  const maxTurns = Math.max(1, config.maxTurns ?? DEFAULT_MAX_TURNS);

  return async (ctx: AssertionContext): Promise<AssertionResult> => {
    const apiKey = ctx.env("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return missingKeyResult(model, samples);
    }

    const client = (deps.createClient ?? defaultClientFactory)(apiKey);
    const userMessage = resolveJudgeInputs(ctx, inputs, config.inputBundle?.() ?? {});

    const verdicts: JudgeVerdict[] = [];
    const toolCalls: Array<{ name: string; input: unknown; output: unknown }> = [];
    let inputTokens = 0;
    let outputTokens = 0;
    const startedAt = Date.now();
    let exhausted = false;
    let runError: string | undefined;

    for (let sample = 0; sample < samples; sample += 1) {
      try {
        const result = await runOneSample({
          client,
          ctx,
          rubric: config.rubric,
          userMessage,
          tools,
          model,
          maxTurns,
        });
        if (result.verdict) {
          verdicts.push(result.verdict);
        } else {
          exhausted = true;
        }
        toolCalls.push(...result.toolCalls);
        inputTokens += result.inputTokens;
        outputTokens += result.outputTokens;
      } catch (error) {
        runError = error instanceof Error ? error.message : String(error);
        break;
      }
    }

    const durationMs = Date.now() - startedAt;
    const aggregate = aggregateVerdicts(verdicts);
    const passed = aggregate?.passed ?? false;
    const message = runError
      ? `judge errored: ${runError}`
      : !aggregate
        ? exhausted
          ? "judge exhausted maxTurns without a verdict"
          : "judge produced no verdicts"
        : aggregate.reasoning;

    const details: JudgeRunDetails = {
      model,
      samples,
      verdicts,
      tokens: { input: inputTokens, output: outputTokens },
      durationMs,
      toolCalls,
    };
    if (runError) details.error = runError;

    return {
      passed,
      message,
      details: { judge: details },
    };
  };
}

function defaultClientFactory(apiKey: string): AnthropicClient {
  return new Anthropic({ apiKey });
}

function missingKeyResult(model: string, samples: number): AssertionResult {
  const details: JudgeRunDetails = {
    model,
    samples,
    verdicts: [],
    tokens: { input: 0, output: 0 },
    durationMs: 0,
    toolCalls: [],
    error: "missing-api-key",
  };
  return {
    passed: false,
    message: "ANTHROPIC_API_KEY not set; judge skipped.",
    details: { judge: details },
  };
}

function aggregateVerdicts(verdicts: JudgeVerdict[]): JudgeVerdict | null {
  if (verdicts.length === 0) return null;
  if (verdicts.length === 1) return verdicts[0] ?? null;

  const passCount = verdicts.filter((v) => v.passed).length;
  const failCount = verdicts.length - passCount;
  if (passCount > failCount) {
    const winners = verdicts.filter((v) => v.passed);
    return mergeVerdicts(true, winners);
  }
  // Tie or more failures: fail.
  const losers = verdicts.filter((v) => !v.passed);
  if (losers.length === 0) {
    return mergeVerdicts(false, verdicts);
  }
  return mergeVerdicts(false, losers);
}

function mergeVerdicts(passed: boolean, group: JudgeVerdict[]): JudgeVerdict {
  const reasoning = group.map((v, i) => `(${i + 1}) ${v.reasoning}`).join(" | ");
  const categories = Array.from(
    new Set(group.flatMap((v) => v.categories ?? [])),
  );
  return {
    passed,
    reasoning,
    categories: categories.length > 0 ? categories : undefined,
  };
}

interface SampleParams {
  client: AnthropicClient;
  ctx: AssertionContext;
  rubric: string;
  userMessage: string;
  tools: JudgeToolName[];
  model: string;
  maxTurns: number;
}

interface SampleResult {
  verdict: JudgeVerdict | null;
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  inputTokens: number;
  outputTokens: number;
}

const VERDICT_TOOL_NAME = "submit_verdict";

async function runOneSample(params: SampleParams): Promise<SampleResult> {
  const toolDefs = buildToolDefs(params.tools);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: params.userMessage },
  ];
  const toolCalls: Array<{ name: string; input: unknown; output: unknown }> = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let verdict: JudgeVerdict | null = null;

  for (let turn = 0; turn < params.maxTurns; turn += 1) {
    const response = await params.client.messages.create({
      model: params.model,
      max_tokens: 2048,
      system: params.rubric,
      tools: toolDefs,
      messages,
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      if (toolUse.name === VERDICT_TOOL_NAME) {
        verdict = parseVerdict(toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "verdict received",
        });
        continue;
      }
      const output = await runJudgeTool(params.ctx, toolUse.name, toolUse.input);
      toolCalls.push({ name: toolUse.name, input: toolUse.input, output });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: typeof output === "string" ? output : JSON.stringify(output).slice(0, 8000),
      });
    }

    if (verdict) break;

    messages.push({ role: "user", content: toolResults });
  }

  return { verdict, toolCalls, inputTokens, outputTokens };
}

function parseVerdict(input: unknown): JudgeVerdict {
  if (input && typeof input === "object") {
    const raw = input as Record<string, unknown>;
    const passed = Boolean(raw.passed);
    const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "";
    const categories =
      Array.isArray(raw.categories) && raw.categories.every((c) => typeof c === "string")
        ? (raw.categories as string[])
        : undefined;
    return { passed, reasoning, categories };
  }
  return { passed: false, reasoning: "judge returned malformed verdict" };
}

function buildToolDefs(tools: JudgeToolName[]): Anthropic.Tool[] {
  const defs: Anthropic.Tool[] = [
    {
      name: VERDICT_TOOL_NAME,
      description:
        "Submit your final verdict. You MUST call this tool exactly once before finishing. Do not call it more than once per run.",
      input_schema: {
        type: "object",
        properties: {
          passed: { type: "boolean", description: "true if the rubric is satisfied" },
          reasoning: { type: "string", description: "concise justification citing evidence" },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "optional tags grouping the finding (e.g. eval-bug, hardcoded-output)",
          },
        },
        required: ["passed", "reasoning"],
      },
    },
  ];

  if (tools.includes("clickhouse-readonly")) {
    defs.push({
      name: "clickhouse_query",
      description: "Run a read-only ClickHouse SQL query (server-side readonly=1). Returns up to ~8KB of result text.",
      input_schema: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
    });
  }
  if (tools.includes("pg-readonly")) {
    defs.push({
      name: "pg_query",
      description: "Run a read-only Postgres query inside a READ ONLY transaction.",
      input_schema: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
    });
  }
  if (tools.includes("http-get")) {
    defs.push({
      name: "http_get",
      description: "HTTP GET a URL. Returns the response body, capped at ~16KB.",
      input_schema: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    });
  }

  return defs;
}

async function runJudgeTool(
  ctx: AssertionContext,
  name: string,
  input: unknown,
): Promise<unknown> {
  if (name === "clickhouse_query") {
    const sql = readSql(input);
    if (!sql) return { error: "missing sql" };
    try {
      const result = await ctx.clickhouse.query({
        query: sql,
        format: "JSONEachRow",
        clickhouse_settings: { readonly: "1" },
      });
      const rows = (await (result as unknown as { json: () => Promise<unknown[]> }).json());
      return { rows: truncateJson(rows) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (name === "pg_query") {
    const sql = readSql(input);
    if (!sql) return { error: "missing sql" };
    try {
      await ctx.pg.query("BEGIN READ ONLY");
      try {
        const result = await ctx.pg.query(sql);
        await ctx.pg.query("ROLLBACK");
        return { rows: truncateJson(result.rows) };
      } catch (inner) {
        await ctx.pg.query("ROLLBACK").catch(() => undefined);
        throw inner;
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (name === "http_get") {
    const url = (input as { url?: unknown })?.url;
    if (typeof url !== "string") return { error: "missing url" };
    try {
      const response = await fetch(url, { method: "GET" });
      const text = (await response.text()).slice(0, HTTP_GET_MAX_BYTES);
      return { status: response.status, body: text };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  return { error: `unknown tool: ${name}` };
}

function readSql(input: unknown): string | null {
  if (input && typeof input === "object") {
    const sql = (input as { sql?: unknown }).sql;
    if (typeof sql === "string" && sql.trim()) return sql;
  }
  return null;
}

function truncateJson(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text.length <= 8000) return value;
  return { truncated: true, preview: text.slice(0, 8000) };
}
