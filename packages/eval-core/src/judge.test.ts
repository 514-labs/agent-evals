import { test } from "node:test";
import assert from "node:assert/strict";

import type { AssertionContext } from "./context.js";
import { llmJudge, type JudgeRunDetails } from "./judge.js";

interface MockMessageResponse {
  content: Array<
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: "text"; text: string }
  >;
  usage: { input_tokens: number; output_tokens: number };
}

function mockClient(responses: MockMessageResponse[]) {
  let index = 0;
  const seen: Array<unknown> = [];
  const client = {
    messages: {
      create: async (params: unknown) => {
        seen.push(params);
        const response = responses[index] ?? responses[responses.length - 1];
        index += 1;
        return response;
      },
    },
  };
  return { client: client as never, seen, get callCount() { return index; } };
}

function fakeContext(env: Record<string, string | undefined> = {}): AssertionContext {
  return {
    pg: { query: async () => ({ rows: [] }) as never },
    clickhouse: { query: async () => ({ json: async () => [] }) as never } as never,
    env: (key: string) => env[key],
  };
}

test("missing ANTHROPIC_API_KEY fails closed without throwing", async () => {
  const judge = llmJudge({ rubric: "test" });
  const result = await judge(fakeContext());
  assert.equal(result.passed, false);
  assert.match(String(result.message), /ANTHROPIC_API_KEY not set/);
  const details = (result.details as { judge: JudgeRunDetails }).judge;
  assert.equal(details.error, "missing-api-key");
});

test("single-call verdict is returned with reasoning", async () => {
  const { client } = mockClient([
    {
      content: [
        { type: "tool_use", id: "v1", name: "submit_verdict", input: { passed: true, reasoning: "looks fine" } },
      ],
      usage: { input_tokens: 100, output_tokens: 25 },
    },
  ]);
  const judge = llmJudge(
    { rubric: "test", inputs: [], samples: 1 },
    { createClient: () => client },
  );
  const result = await judge(fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }));
  assert.equal(result.passed, true);
  assert.equal(result.message, "looks fine");
  const details = (result.details as { judge: JudgeRunDetails }).judge;
  assert.equal(details.verdicts.length, 1);
  assert.equal(details.tokens.input, 100);
  assert.equal(details.tokens.output, 25);
});

test("N-sample majority: 2 pass, 1 fail produces pass", async () => {
  const verdictResponse = (passed: boolean, id: string): MockMessageResponse => ({
    content: [
      { type: "tool_use", id, name: "submit_verdict", input: { passed, reasoning: passed ? "good" : "bad" } },
    ],
    usage: { input_tokens: 50, output_tokens: 10 },
  });
  const { client } = mockClient([verdictResponse(true, "a"), verdictResponse(true, "b"), verdictResponse(false, "c")]);
  const judge = llmJudge(
    { rubric: "test", inputs: [], samples: 3 },
    { createClient: () => client },
  );
  const result = await judge(fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }));
  assert.equal(result.passed, true);
  const details = (result.details as { judge: JudgeRunDetails }).judge;
  assert.equal(details.verdicts.length, 3);
});

test("N-sample tie defaults to fail", async () => {
  const verdictResponse = (passed: boolean, id: string): MockMessageResponse => ({
    content: [
      { type: "tool_use", id, name: "submit_verdict", input: { passed, reasoning: passed ? "good" : "bad" } },
    ],
    usage: { input_tokens: 50, output_tokens: 10 },
  });
  const { client } = mockClient([verdictResponse(true, "a"), verdictResponse(false, "b")]);
  const judge = llmJudge(
    { rubric: "test", inputs: [], samples: 2 },
    { createClient: () => client },
  );
  const result = await judge(fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }));
  assert.equal(result.passed, false);
});

test("maxTurns exhaustion fails with explanatory message", async () => {
  const noopText: MockMessageResponse = {
    content: [{ type: "text", text: "I am still thinking..." }],
    usage: { input_tokens: 30, output_tokens: 5 },
  };
  const { client } = mockClient([noopText]);
  const judge = llmJudge(
    { rubric: "test", inputs: [], maxTurns: 2 },
    { createClient: () => client },
  );
  const result = await judge(fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }));
  assert.equal(result.passed, false);
  assert.match(String(result.message), /maxTurns/);
});

test("malformed verdict input fails with reasoning", async () => {
  const { client } = mockClient([
    {
      content: [
        { type: "tool_use", id: "x", name: "submit_verdict", input: "not-an-object" },
      ],
      usage: { input_tokens: 10, output_tokens: 2 },
    },
  ]);
  const judge = llmJudge(
    { rubric: "test", inputs: [] },
    { createClient: () => client },
  );
  const result = await judge(fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }));
  assert.equal(result.passed, false);
  assert.match(String(result.message), /malformed/);
});

test("tool calls are recorded in details", async () => {
  let firstCall = true;
  const responses: MockMessageResponse[] = [
    {
      content: [
        { type: "tool_use", id: "q1", name: "clickhouse_query", input: { sql: "SELECT 1" } },
      ],
      usage: { input_tokens: 40, output_tokens: 8 },
    },
    {
      content: [
        { type: "tool_use", id: "v1", name: "submit_verdict", input: { passed: true, reasoning: "row count ok" } },
      ],
      usage: { input_tokens: 60, output_tokens: 12 },
    },
  ];
  const { client } = mockClient(responses);

  const ctx: AssertionContext = {
    ...fakeContext({ ANTHROPIC_API_KEY: "sk-ant-test" }),
    clickhouse: {
      query: async () => {
        const wasFirst = firstCall;
        firstCall = false;
        return { json: async () => (wasFirst ? [{ n: 1 }] : []) } as never;
      },
    } as never,
  };

  const judge = llmJudge(
    { rubric: "test", inputs: [], tools: ["clickhouse-readonly"] },
    { createClient: () => client },
  );
  const result = await judge(ctx);
  assert.equal(result.passed, true);
  const details = (result.details as { judge: JudgeRunDetails }).judge;
  assert.equal(details.toolCalls.length, 1);
  assert.equal(details.toolCalls[0]?.name, "clickhouse_query");
});
