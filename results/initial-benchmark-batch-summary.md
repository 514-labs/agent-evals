# Initial Benchmark Results

These DEC Bench 0.1 runs are the rebuilt research-preview comparison slice for the project.

## Scope

- 6 scenarios
- 24 total runs
- 4 model systems
- 2 harnesses: `base-rt` and `classic-de`
- Persona: `naive`
- Plan mode: `no-plan`

Scenario slice:

- `foo-bar-csv-ingest`
- `foo-bar-broken-connection`
- `foo-bar-postgres-index-tuning`
- `foo-bar-stream-to-olap`
- `foo-bar-time-grain-rollups`
- `foo-bar-cross-system-reconciliation`

## Headline

`Cursor Composer` led this rebuilt slice on average normalized score. The matrix now has a full 24-entry comparison set, with two explicitly marked timeout failures standing in for Claude runs that repeatedly hung on Kafka-consume behavior during serialized retries.

## Outcome Table

| Scenario | Claude Sonnet 4.6 | Claude Opus 4.6 | GPT-5.4 / Codex | Cursor Composer |
| --- | --- | --- | --- | --- |
| `foo-bar-csv-ingest` | G0 | G0 | G3 | G4 |
| `foo-bar-broken-connection` | G4 | G0 | G4 | G4 |
| `foo-bar-postgres-index-tuning` | G1 | G3 | G3 | G4 |
| `foo-bar-stream-to-olap` | G4 | G0 (timeout) | G4 | G4 |
| `foo-bar-time-grain-rollups` | G4 | G4 | G4 | G4 |
| `foo-bar-cross-system-reconciliation` | G0 (timeout) | G2 | G0 | G0 |

## Model Summary

| System | Avg. highest gate | Avg. normalized score | Gate 4+ | Gate 5 | Synthetic timeouts |
| --- | --- | --- | --- | --- | --- |
| Claude Sonnet 4.6 | 2.17 | 0.53 | 3/6 | 0/6 | 1/6 |
| Claude Opus 4.6 | 1.50 | 0.39 | 1/6 | 0/6 | 1/6 |
| GPT-5.4 / Codex | 3.00 | 0.74 | 3/6 | 0/6 | 0/6 |
| Cursor Composer | 3.33 | 0.84 | 5/6 | 0/6 | 0/6 |

## Notes

- The public web app now ships a checked-in seeded bundle derived from this rebuilt batch so the leaderboard and audit routes have deterministic production data.
- Two runs are represented as synthetic timeout failures rather than missing data: `foo-bar-stream-to-olap` with Claude Opus 4.6 and `foo-bar-cross-system-reconciliation` with Claude Sonnet 4.6.
- Those synthetic entries preserve the exact run IDs from the failed retries and are labeled with `result_kind: synthetic-timeout` plus timeout notes in the exported audit logs.
- Cross-vendor cost comparisons are still directional. Gate progression and normalized score remain the most reliable public comparison axes for this slice.
