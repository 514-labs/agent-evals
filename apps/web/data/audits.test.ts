import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getAuditRunManifest,
  getAuditRunTrace,
  getScenarioAuditContext,
  getScenarioAuditIndex,
  listAuditScenarios,
  readAuditLogChunk,
  resolveAuditLogPath,
} from "./audits";

test("audit loaders index manifests and read log chunks", () => {
  const originalCwd = process.cwd();
  const originalAuditsDir = process.env.DEC_BENCH_AUDITS_DIR;
  const fixtureRoot = mkdtempSync(join(tmpdir(), "audit-data-"));

  try {
    process.chdir(fixtureRoot);

    const scenario = "scenario-one";
    const runId = "run-001";
    const runDir = join(fixtureRoot, "data", "audits", scenario, runId);
    mkdirSync(join(runDir, "logs"), { recursive: true });
    writeFileSync(join(runDir, "stdout.log"), "line1\nline2\nline3\nline4\n", "utf8");
    writeFileSync(join(runDir, "logs", "service.log"), "service-a\nservice-b\n", "utf8");
    writeFileSync(
      join(runDir, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: "1",
          runId,
          scenario,
          timestamp: "2026-03-02T01:02:03.000Z",
          harness: "base-rt",
          agent: "claude-code",
          model: "claude-sonnet-4-20250514",
          version: "v1.0.0",
          highestGate: 4,
          normalizedScore: 0.95,
          efficiency: {
            wallClockSeconds: 12,
            agentSteps: 34,
            tokensUsed: 56,
            llmApiCostUsd: 0.25,
          },
          gates: {
            functional: { passed: true, score: 1, core: {}, scenario: {} },
            correct: { passed: true, score: 1, core: {}, scenario: {} },
            robust: { passed: true, score: 1, core: {}, scenario: {} },
            performant: { passed: true, score: 1, core: {}, scenario: {} },
            production: {
              passed: false,
              score: 1,
              core: { uses_env_vars: false, no_secrets_in_code: true },
              scenario: { connection_env_vars_available: true, no_temporary_tables: true },
            },
          },
          logs: [
            {
              id: "stdout",
              label: "Run stdout",
              kind: "stdout",
              relativePath: "stdout.log",
              bytes: 24,
              compression: "none",
            },
            {
              id: "service",
              label: "Service",
              kind: "service",
              relativePath: "logs/service.log",
              bytes: 20,
              compression: "none",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    mkdirSync(join(fixtureRoot, "scenarios", scenario, "prompts"), { recursive: true });
    writeFileSync(
      join(fixtureRoot, "scenarios", scenario, "scenario.json"),
      JSON.stringify(
        {
          id: scenario,
          title: "Scenario One",
          description: "Fixture scenario",
          tier: "tier-1",
          domain: "foo",
          harness: "base-rt",
          tasks: [{ id: "task-1", description: "Do thing", category: "ingestion" }],
          personaPrompts: {
            naive: "prompts/naive.md",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    writeFileSync(join(fixtureRoot, "scenarios", scenario, "prompts", "naive.md"), "hello prompt", "utf8");

    process.env.DEC_BENCH_AUDITS_DIR = join(fixtureRoot, "data", "audits");

    const scenarios = listAuditScenarios();
    assert.deepEqual(scenarios, [scenario]);

    const index = getScenarioAuditIndex(scenario);
    assert.ok(index);
    assert.equal(index?.runs.length, 1);
    assert.equal(index?.runs[0]?.runId, runId);
    assert.equal(index?.runs[0]?.normalizedScore, 0.95);

    const manifest = getAuditRunManifest(scenario, runId);
    assert.ok(manifest);
    assert.equal(manifest?.logs.length, 2);
    assert.equal(manifest?.normalizedScore, 0.95);

    const resolved = resolveAuditLogPath(scenario, runId, "stdout");
    assert.ok(resolved);
    assert.match(resolved?.absolutePath ?? "", /stdout\.log$/);

    const chunk = readAuditLogChunk(scenario, runId, "stdout", 1, 2);
    assert.ok(chunk);
    assert.equal(chunk?.startLine, 1);
    assert.equal(chunk?.endLine, 2);
    assert.equal(chunk?.content, "line2\nline3");

    const context = getScenarioAuditContext(scenario);
    assert.ok(context);
    assert.equal(context?.prompts[0]?.content, "hello prompt");
  } finally {
    if (originalAuditsDir === undefined) {
      delete process.env.DEC_BENCH_AUDITS_DIR;
    } else {
      process.env.DEC_BENCH_AUDITS_DIR = originalAuditsDir;
    }
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("cursor trace normalization extracts readable event content", () => {
  const originalCwd = process.cwd();
  const originalAuditsDir = process.env.DEC_BENCH_AUDITS_DIR;
  const fixtureRoot = mkdtempSync(join(tmpdir(), "audit-trace-"));

  try {
    process.chdir(fixtureRoot);

    const scenario = "scenario-cursor";
    const runId = "run-cursor-001";
    const runDir = join(fixtureRoot, "data", "audits", scenario, runId);
    mkdirSync(join(runDir, "logs"), { recursive: true });
    writeFileSync(join(runDir, "stdout.log"), "ok\n", "utf8");
    writeFileSync(
      join(runDir, "logs", "trace.json"),
      JSON.stringify(
        {
          schemaVersion: "2",
          source: "cursor-stream-json",
          events: [
            {
              id: "evt-0",
              kind: "user",
              payload: {
                type: "user",
                message: {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "You are running inside a sandboxed Docker container for a benchmark evaluation. Keep going.\n\nactual scenario prompt",
                    },
                  ],
                },
              },
            },
            {
              id: "evt-1",
              kind: "assistant",
              payload: {
                type: "assistant",
                timestamp_ms: 1000,
                message: {
                  role: "assistant",
                  content: [{ type: "text", text: "first response" }],
                },
              },
            },
            {
              id: "evt-2",
              kind: "tool_call",
              payload: {
                type: "tool_call",
                subtype: "started",
                call_id: "call-1",
                tool_call: {
                  shellToolCall: {
                    args: {
                      command: "echo hi",
                      description: "run command",
                    },
                  },
                },
              },
            },
            {
              id: "evt-3",
              kind: "tool_call",
              payload: {
                type: "tool_call",
                subtype: "completed",
                call_id: "call-1",
                tool_call: {
                  shellToolCall: {
                    result: {
                      success: {
                        stdout: "ok",
                      },
                    },
                  },
                },
              },
            },
            {
              id: "evt-4",
              kind: "result",
              payload: {
                type: "result",
                result: "final answer",
                is_error: false,
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    writeFileSync(
      join(runDir, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: "1",
          runId,
          scenario,
          timestamp: "2026-03-04T00:00:00.000Z",
          harness: "base-rt",
          agent: "cursor",
          model: "composer",
          version: "v0.1.0",
          highestGate: 1,
          normalizedScore: 0.5,
          efficiency: {
            wallClockSeconds: 1,
            agentSteps: 1,
            tokensUsed: 1,
            llmApiCostUsd: 0,
          },
          gates: {
            functional: { passed: true, score: 1, core: {}, scenario: {} },
            correct: { passed: false, score: 0, core: {}, scenario: {} },
            robust: { passed: false, score: 0, core: {}, scenario: {} },
            performant: { passed: false, score: 0, core: {}, scenario: {} },
            production: { passed: false, score: 0, core: {}, scenario: {} },
          },
          logs: [
            {
              id: "stdout",
              label: "Run stdout",
              kind: "stdout",
              relativePath: "stdout.log",
              bytes: 3,
              compression: "none",
            },
            {
              id: "trace",
              label: "Agent trace",
              kind: "trace",
              relativePath: "logs/trace.json",
              bytes: 100,
              compression: "none",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    process.env.DEC_BENCH_AUDITS_DIR = join(fixtureRoot, "data", "audits");

    const trace = getAuditRunTrace(scenario, runId);
    assert.ok(trace);
    assert.equal(trace?.events?.[0]?.kind, "system_message");
    assert.equal(
      trace?.events?.[0]?.content,
      "You are running inside a sandboxed Docker container for a benchmark evaluation. Keep going.",
    );
    assert.equal(trace?.events?.[1]?.kind, "user_message");
    assert.equal(trace?.events?.[1]?.content, "actual scenario prompt");
    assert.equal(trace?.events?.[2]?.kind, "assistant_text");
    assert.equal(trace?.events?.[2]?.content, "first response");
    assert.equal(trace?.events?.[3]?.kind, "tool_use");
    assert.equal(trace?.events?.[3]?.content, "run command");
    assert.equal(trace?.events?.[4]?.kind, "tool_result");
    assert.equal(trace?.events?.[4]?.content, "ok");
    assert.equal(trace?.events?.[5]?.kind, "assistant_final");
    assert.equal(trace?.events?.[5]?.content, "final answer");
  } finally {
    if (originalAuditsDir === undefined) {
      delete process.env.DEC_BENCH_AUDITS_DIR;
    } else {
      process.env.DEC_BENCH_AUDITS_DIR = originalAuditsDir;
    }
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("codex trace normalization extracts readable assistant and shell events", () => {
  const originalCwd = process.cwd();
  const originalAuditsDir = process.env.DEC_BENCH_AUDITS_DIR;
  const fixtureRoot = mkdtempSync(join(tmpdir(), "audit-trace-codex-"));

  try {
    process.chdir(fixtureRoot);

    const scenario = "scenario-codex";
    const runId = "run-codex-001";
    const runDir = join(fixtureRoot, "data", "audits", scenario, runId);
    mkdirSync(join(runDir, "logs"), { recursive: true });
    writeFileSync(join(runDir, "stdout.log"), "ok\n", "utf8");
    writeFileSync(
      join(runDir, "logs", "trace.json"),
      JSON.stringify(
        {
          schemaVersion: "2",
          source: "codex-jsonl",
          events: [
            {
              id: "evt-0",
              kind: "thread.started",
              payload: {
                type: "thread.started",
                thread_id: "thread-123",
              },
            },
            {
              id: "evt-1",
              kind: "turn.started",
              payload: {
                type: "turn.started",
              },
            },
            {
              id: "evt-2",
              kind: "item.completed",
              payload: {
                type: "item.completed",
                item: {
                  id: "item-1",
                  type: "agent_message",
                  text: "I found the loader and I am checking the DB config.",
                },
              },
            },
            {
              id: "evt-3",
              kind: "item.started",
              payload: {
                type: "item.started",
                item: {
                  id: "item-2",
                  type: "command_execution",
                  command: "/bin/bash -lc 'ls -la /workspace'",
                  aggregated_output: "",
                  exit_code: null,
                  status: "in_progress",
                },
              },
            },
            {
              id: "evt-4",
              kind: "item.completed",
              payload: {
                type: "item.completed",
                item: {
                  id: "item-2",
                  type: "command_execution",
                  command: "/bin/bash -lc 'ls -la /workspace'",
                  aggregated_output: "load_data.py\ninit.sql\n",
                  exit_code: 0,
                  status: "completed",
                },
              },
            },
            {
              id: "evt-5",
              kind: "item.completed",
              payload: {
                type: "item.completed",
                item: {
                  id: "item-3",
                  type: "todo_list",
                  items: [
                    { text: "Inspect loader", completed: true },
                    { text: "Patch credentials", completed: false },
                  ],
                },
              },
            },
            {
              id: "evt-6",
              kind: "item.completed",
              payload: {
                type: "item.completed",
                item: {
                  id: "item-4",
                  type: "file_change",
                  changes: [{ path: "/workspace/load_data.py", kind: "update" }],
                  status: "completed",
                },
              },
            },
            {
              id: "evt-7",
              kind: "item.completed",
              payload: {
                type: "item.completed",
                item: {
                  id: "item-5",
                  type: "command_execution",
                  command: "/bin/bash -lc 'rg config /workspace'",
                  aggregated_output: "/bin/bash: line 1: rg: command not found\n",
                  exit_code: 127,
                  status: "failed",
                },
              },
            },
            {
              id: "evt-8",
              kind: "turn.completed",
              payload: {
                type: "turn.completed",
                usage: {
                  input_tokens: 120,
                  cached_input_tokens: 40,
                  output_tokens: 12,
                },
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    writeFileSync(
      join(runDir, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: "1",
          runId,
          scenario,
          timestamp: "2026-03-14T00:00:00.000Z",
          harness: "base-rt",
          agent: "codex",
          model: "gpt-5.1-codex-mini",
          version: "v0.1.0",
          highestGate: 0,
          normalizedScore: 0.1,
          efficiency: {
            wallClockSeconds: 1,
            agentSteps: 1,
            tokensUsed: 1,
            llmApiCostUsd: 0,
          },
          gates: {
            functional: { passed: false, score: 0, core: {}, scenario: {} },
            correct: { passed: false, score: 0, core: {}, scenario: {} },
            robust: { passed: false, score: 0, core: {}, scenario: {} },
            performant: { passed: false, score: 0, core: {}, scenario: {} },
            production: { passed: false, score: 0, core: {}, scenario: {} },
          },
          logs: [
            {
              id: "stdout",
              label: "Run stdout",
              kind: "stdout",
              relativePath: "stdout.log",
              bytes: 3,
              compression: "none",
            },
            {
              id: "trace",
              label: "Agent trace",
              kind: "trace",
              relativePath: "logs/trace.json",
              bytes: 100,
              compression: "none",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    process.env.DEC_BENCH_AUDITS_DIR = join(fixtureRoot, "data", "audits");

    const trace = getAuditRunTrace(scenario, runId);
    assert.ok(trace);
    assert.equal(trace?.events?.[0]?.kind, "event");
    assert.equal(trace?.events?.[0]?.content, "Thread started: thread-123");
    assert.equal(trace?.events?.[1]?.kind, "event");
    assert.equal(trace?.events?.[1]?.content, "Turn started.");
    assert.equal(trace?.events?.[2]?.kind, "assistant_text");
    assert.equal(
      trace?.events?.[2]?.content,
      "I found the loader and I am checking the DB config.",
    );
    assert.equal(trace?.events?.[3]?.kind, "tool_use");
    assert.equal(trace?.events?.[3]?.content, "/bin/bash -lc 'ls -la /workspace'");
    assert.equal(trace?.events?.[4]?.kind, "tool_result");
    assert.equal(trace?.events?.[4]?.content, "load_data.py\ninit.sql\n");
    assert.equal(trace?.events?.[5]?.kind, "thinking");
    assert.equal(
      trace?.events?.[5]?.content,
      "[x] Inspect loader\n[ ] Patch credentials",
    );
    assert.equal(trace?.events?.[6]?.kind, "event");
    assert.equal(trace?.events?.[6]?.content, "update /workspace/load_data.py");
    assert.equal(trace?.events?.[7]?.kind, "tool_result");
    assert.equal(trace?.events?.[7]?.isError, true);
    assert.equal(
      trace?.events?.[7]?.content,
      "/bin/bash: line 1: rg: command not found\n",
    );
    assert.equal(trace?.events?.[8]?.kind, "assistant_final");
    assert.equal(
      trace?.events?.[8]?.content,
      "Turn completed. input 120 · cached 40 · output 12",
    );
  } finally {
    if (originalAuditsDir === undefined) {
      delete process.env.DEC_BENCH_AUDITS_DIR;
    } else {
      process.env.DEC_BENCH_AUDITS_DIR = originalAuditsDir;
    }
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
