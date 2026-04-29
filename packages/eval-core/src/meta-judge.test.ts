import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyMetaJudgeFilter,
  discoverMetaJudges,
} from "./meta-judge-discovery.js";

function makeMetaJudgesTree(): string {
  const root = mkdtempSync(join(tmpdir(), "metajudges-"));
  const goodDir = join(root, "good-judge");
  mkdirSync(goodDir);
  writeFileSync(
    join(goodDir, "meta-judge.json"),
    JSON.stringify({
      id: "good-judge",
      title: "Good",
      inputs: ["sessionLog"],
      tools: [],
      model: "claude-sonnet-4-6",
      samples: 1,
      maxTurns: 4,
      advisory: true,
    }),
  );
  writeFileSync(join(goodDir, "rubric.md"), "# Always pass\n\nCall submit_verdict with passed=true.");

  // A malformed folder: missing rubric.md.
  const brokenDir = join(root, "broken-judge");
  mkdirSync(brokenDir);
  writeFileSync(join(brokenDir, "meta-judge.json"), JSON.stringify({ id: "broken-judge", inputs: [] }));

  // A folder with malformed JSON.
  const badJsonDir = join(root, "bad-json-judge");
  mkdirSync(badJsonDir);
  writeFileSync(join(badJsonDir, "meta-judge.json"), "{ not valid json");
  writeFileSync(join(badJsonDir, "rubric.md"), "ignored");

  return root;
}

test("discoverMetaJudges loads valid folders and skips invalid ones", () => {
  const root = makeMetaJudgesTree();
  try {
    const judges = discoverMetaJudges(root);
    const ids = judges.map((judge) => judge.id).sort();
    assert.deepEqual(ids, ["good-judge"]);
    assert.equal(judges[0]?.manifest.advisory, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverMetaJudges returns empty when directory missing", () => {
  const judges = discoverMetaJudges("/nonexistent/path");
  assert.deepEqual(judges, []);
});

test("applyMetaJudgeFilter respects globalDisable", () => {
  const root = makeMetaJudgesTree();
  try {
    const judges = discoverMetaJudges(root);
    assert.equal(applyMetaJudgeFilter(judges, { globalDisable: true }).length, 0);
    assert.equal(applyMetaJudgeFilter(judges, {}).length, judges.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("applyMetaJudgeFilter respects per-judge opt-out via scenarioOptOut", () => {
  const root = makeMetaJudgesTree();
  try {
    const judges = discoverMetaJudges(root);
    const filtered = applyMetaJudgeFilter(judges, {
      scenarioOptOut: { "good-judge": false },
    });
    assert.deepEqual(filtered.map((j) => j.id), []);
    const passthrough = applyMetaJudgeFilter(judges, {
      scenarioOptOut: { "good-judge": true },
    });
    assert.equal(passthrough.length, judges.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
