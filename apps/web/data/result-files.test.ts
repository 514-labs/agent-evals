import assert from "node:assert/strict";
import test from "node:test";

import { isCanonicalResultFile, isSidecarFile } from "./result-files";

test("leaderboard result files only include canonical json artifacts", () => {
  assert.equal(isCanonicalResultFile("foo-bar-csv-ingest-1773430402.json"), true);
  assert.equal(isCanonicalResultFile("foo-bar-csv-ingest.stdout.log"), false);
  assert.equal(isCanonicalResultFile("foo-bar-broken-connection-run3.log"), false);
  assert.equal(isCanonicalResultFile("foo-bar-csv-ingest.trace.json"), false);
});

test("sidecar detection excludes non-result json files", () => {
  assert.equal(isSidecarFile("foo-bar-csv-ingest.trace.json"), true);
  assert.equal(isSidecarFile("foo-bar-csv-ingest.agent-raw.json"), true);
  assert.equal(isSidecarFile("foo-bar-csv-ingest.json"), false);
});
