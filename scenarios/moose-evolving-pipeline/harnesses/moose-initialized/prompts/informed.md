Build an evolving analytics pipeline in four phases using MooseStack. Docs: https://docs.getmoose.dev/

A Moose project has already been scaffolded at `/workspace/moose-project` with dependencies installed. The default ClickHouse database is `analytics`. `cd` into the project and start the dev server:

```bash
cd /workspace/moose-project
nohup moose dev --dockerless --agent > moose.log 2>&1 &
```

Then wait for it to become healthy (takes ~30s):
```bash
/opt/dec-bench/tools/moose/wait-for-output.sh moose.log "Next Steps" 120
```

**Important:**
- Do NOT run `moose-tspc` or `moose build` manually — the dev server compiles automatically on file save.
- Do NOT restart or `pkill` the dev server. `moose ls` shows empty output until you save a valid `app/index.ts` — this is normal.
- After saving a file, wait for hot-reload to finish before checking results. Use the helper:
  ```
  /opt/dec-bench/tools/moose/wait-for-output.sh moose.log "Infrastructure changes processed|error" 30
  ```
  This blocks until moose finishes applying changes (or errors), then returns the matching line. Use it instead of `sleep && tail`.
- The dev server runs in `--agent` mode, which means destructive schema changes (like dropping a column) will trigger a prompt via the MCP endpoint at `http://localhost:4000/mcp`. To approve a pending prompt, call `respond_to_prompt` with response "y":
  ```bash
  curl -s -X POST http://localhost:4000/mcp -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"respond_to_prompt","arguments":{"response":"y"}}}'
  ```
  If moose is blocking on a prompt, `wait-for-output.sh` will time out — check for a pending prompt and respond before retrying.
- Check compilation errors with: `grep -i error moose.log | tail -5`

**Phase 1 — Ingest and aggregate**

Postgres has `raw.events` (60 rows, columns: event_id, event_ts, user_id, event_type, product_id, amount). Define a Moose data model for events and load all 60 rows into ClickHouse. Create a materialized view or aggregation table for daily revenue per product (from purchase events only).

**Phase 2 — Schema evolution and backfill**

Postgres also has `raw.events_v2` (40 rows) with the same columns plus `region` (String) and `device` (String). Evolve your Moose data model to add `region` and `device` fields. Moose handles the ClickHouse schema migration. Then:

1. Load all 40 v2 rows with their actual region/device values.
2. Backfill the 60 existing rows with `region='unknown'` and `device='unknown'`.
3. Update the daily revenue aggregation to include `region` as a dimension.

After this phase, `analytics.events` should have exactly 100 rows, all with non-empty region values.

**Phase 3 — HTTP API**

Stand up an HTTP server on port 3000 (or add Moose API routes) with:

- `GET /api/revenue-by-region` → JSON array of `{ region, total_revenue }` objects, one per region, ordered by total_revenue DESC.
- `GET /api/top-products?limit=N` → JSON array of `{ product_id, total_revenue, purchase_count }` objects, ordered by total_revenue DESC, limited to N results (default 5).

Both endpoints must return valid JSON under 200ms.

**Phase 4 — Destructive schema change**

The `device` column is no longer needed. Remove it from your Moose data model in `app/index.ts` (delete the `device` field from the Event interface) and save the file. Moose will detect the destructive column drop and apply it automatically — do NOT run the DDL yourself. Wait for the dev server to process the migration, then verify:

1. `DESCRIBE TABLE analytics.events` no longer lists a `device` column.
2. All 100 rows are still present (`SELECT count() FROM analytics.events` = 100).
3. Both API endpoints from Phase 3 still return correct data.
