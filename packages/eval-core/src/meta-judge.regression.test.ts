import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import type { AssertionContext } from "./context.js";
import { llmJudge } from "./judge.js";
import type { AssertionOutcome, JudgeInputName } from "./judge-inputs.js";
import type { MetaJudgeManifest } from "./meta-judge-discovery.js";
import type { JudgeRunDetails } from "./judge.js";

const META_JUDGES_ROOT = resolve(import.meta.dirname, "../../../meta-judges");
const SKIP = !process.env.ANTHROPIC_API_KEY;

function fixtureContext(): AssertionContext {
  return {
    pg: { query: async () => ({ rows: [] }) as never },
    clickhouse: { query: async () => ({ json: async () => [] }) as never } as never,
    env: (key: string) => process.env[key],
  };
}

interface ExpectedVerdict {
  passed: boolean;
  categories?: string[];
}

function readFixtureOverrides(fixtureDir: string, inputs: JudgeInputName[]): {
  overrides: Partial<Record<JudgeInputName, string>>;
  outcomes: AssertionOutcome[];
} {
  const overrides: Partial<Record<JudgeInputName, string>> = {};
  let outcomes: AssertionOutcome[] = [];

  for (const input of inputs) {
    if (input === "assertionOutcomes") {
      const path = join(fixtureDir, "assertionOutcomes.json");
      if (existsSync(path)) {
        outcomes = JSON.parse(readFileSync(path, "utf8")) as AssertionOutcome[];
      }
      continue;
    }
    const candidates = [`${input}.txt`, `${input}.md`];
    for (const candidate of candidates) {
      const path = join(fixtureDir, candidate);
      if (existsSync(path)) {
        overrides[input] = readFileSync(path, "utf8");
        break;
      }
    }
  }
  return { overrides, outcomes };
}

function listMetaJudgeDirs(): string[] {
  if (!existsSync(META_JUDGES_ROOT)) return [];
  return readdirSync(META_JUDGES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(META_JUDGES_ROOT, entry.name));
}

for (const judgeDir of listMetaJudgeDirs()) {
  const manifestPath = join(judgeDir, "meta-judge.json");
  const rubricPath = join(judgeDir, "rubric.md");
  if (!existsSync(manifestPath) || !existsSync(rubricPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MetaJudgeManifest;
  const rubric = readFileSync(rubricPath, "utf8");
  const fixturesDir = join(judgeDir, "fixtures");
  if (!existsSync(fixturesDir)) continue;

  const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(fixturesDir, entry.name));

  for (const fixtureDir of fixtures) {
    const expectedPath = join(fixtureDir, "expected.json");
    if (!existsSync(expectedPath)) continue;
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedVerdict;

    test(`${manifest.id} :: ${fixtureDir.split("/").pop()}`, { skip: SKIP }, async () => {
      const { overrides, outcomes } = readFixtureOverrides(fixtureDir, manifest.inputs);
      const judgeFn = llmJudge({
        rubric,
        inputs: manifest.inputs,
        tools: manifest.tools,
        model: manifest.model,
        samples: manifest.samples,
        maxTurns: manifest.maxTurns,
        inputBundle: () => ({ assertionOutcomes: outcomes, overrides }),
      });
      const result = await judgeFn(fixtureContext());
      const details = (result.details as { judge: JudgeRunDetails }).judge;
      assert.equal(
        result.passed,
        expected.passed,
        `expected passed=${expected.passed}, got passed=${result.passed}. Reasoning: ${result.message}`,
      );
      if (expected.categories && expected.categories.length > 0) {
        const actualCategories = details.verdicts.flatMap((v) => v.categories ?? []);
        const overlap = expected.categories.some((category) => actualCategories.includes(category));
        assert.ok(
          overlap,
          `expected at least one of ${JSON.stringify(expected.categories)} in verdicts. Got: ${JSON.stringify(actualCategories)}`,
        );
      }
    });
  }
}

if (statSync(META_JUDGES_ROOT).isDirectory() && listMetaJudgeDirs().length === 0) {
  test("meta-judges directory has no judges", () => {
    assert.fail(`No meta-judge folders found under ${META_JUDGES_ROOT}`);
  });
}
