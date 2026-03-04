import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getAuditRunManifest,
  getScenarioAuditContext,
  getScenarioAuditIndex,
  listAuditScenarios,
  readAuditLogChunk,
  resolveAuditLogPath,
} from "./audits";

test("audit loaders index manifests and read log chunks", () => {
  const originalCwd = process.cwd();
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
          harness: "bare",
          agent: "claude-code",
          model: "claude-sonnet-4-20250514",
          version: "v1.0.0",
          highestGate: 4,
          normalizedScore: 1,
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
            production: { passed: false, score: 0.5, core: {}, scenario: {} },
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
          harness: "bare",
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

    const scenarios = listAuditScenarios();
    assert.deepEqual(scenarios, [scenario]);

    const index = getScenarioAuditIndex(scenario);
    assert.ok(index);
    assert.equal(index?.runs.length, 1);
    assert.equal(index?.runs[0]?.runId, runId);

    const manifest = getAuditRunManifest(scenario, runId);
    assert.ok(manifest);
    assert.equal(manifest?.logs.length, 2);

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
    process.chdir(originalCwd);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
