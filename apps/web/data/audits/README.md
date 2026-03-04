# Audit Run Bundle Format

The audit UI reads static, repo-checked run bundles from:

- `apps/web/data/audits/<scenario>/index.json`
- `apps/web/data/audits/<scenario>/<runId>/manifest.json`
- `apps/web/data/audits/<scenario>/<runId>/stdout.log`
- `apps/web/data/audits/<scenario>/<runId>/logs/*.log`

The goal is to keep listing pages fast while still preserving full raw output for audit.

## `index.json`

Scenario-level run index used for static route generation.

```json
{
  "schemaVersion": "1",
  "scenario": "foo-bar-csv-ingest",
  "runs": [
    {
      "runId": "2026-03-02T010203Z-bare-naive",
      "scenario": "foo-bar-csv-ingest",
      "timestamp": "2026-03-02T01:02:03.000Z",
      "harness": "bare",
      "agent": "claude-code",
      "model": "claude-sonnet-4-20250514",
      "version": "v1.0.0",
      "highestGate": 4,
      "normalizedScore": 1,
      "availableLogs": 2
    }
  ]
}
```

## `manifest.json`

Run-level metadata and file references.

```json
{
  "schemaVersion": "1",
  "runId": "2026-03-02T010203Z-bare-naive",
  "scenario": "foo-bar-csv-ingest",
  "timestamp": "2026-03-02T01:02:03.000Z",
  "harness": "bare",
  "agent": "claude-code",
  "model": "claude-sonnet-4-20250514",
  "version": "v1.0.0",
  "highestGate": 4,
  "normalizedScore": 1,
  "efficiency": {
    "wallClockSeconds": 150,
    "agentSteps": 0,
    "tokensUsed": 0,
    "llmApiCostUsd": 0
  },
  "gates": {},
  "logs": [
    {
      "id": "stdout",
      "label": "Run stdout",
      "kind": "stdout",
      "relativePath": "stdout.log",
      "bytes": 12345,
      "compression": "none"
    }
  ],
  "notes": ["optional free-form notes"]
}
```

## Scale Notes

- Keep large raw output in `.log` files, not in JSON.
- Use `compression: "gzip"` for `*.log.gz` files.
- Keep `index.json` and `manifest.json` compact and deterministic to minimize noisy diffs.
