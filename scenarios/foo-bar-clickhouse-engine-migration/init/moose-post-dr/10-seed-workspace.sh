#!/usr/bin/env bash
set -euo pipefail

# Scaffold a Moose project under /workspace/moose-project pinned to moose-lib@0.6.520.
# Enables migrate_with_deltas so the DR delta-file flow is active.

CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
PROJECT_DIR="/workspace/moose-project"

mkdir -p "$PROJECT_DIR/app"
cd "$PROJECT_DIR"

cat > package.json <<'JSON'
{
  "name": "engine-migration-workspace",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {
    "@514labs/moose-lib": "0.6.520"
  }
}
JSON

mkdir -p node_modules/@514labs
cp -r /opt/dec-bench/moose/node_modules/@514labs/moose-lib node_modules/@514labs/moose-lib

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["app/**/*.ts"]
}
JSON

cat > moose.config.toml <<CONF
[project]
name = "engine-migration"
language = "typescript"

[features]
migrate_with_deltas = true

[clickhouse_config]
db_name = "analytics"
user = "default"
password = ""
host = "localhost"
host_port = 8123
use_ssl = false
native_port = 9000
CONF

cat > app/index.ts <<'TS'
import { OlapTable, ClickHouseEngines } from "@514labs/moose-lib";

interface Event {
  event_id: string;
  user_id: string;
  event_type: string;
  value: number;
  updated_at: Date;
}

export const events = new OlapTable<Event>("events", {
  orderByFields: ["event_id"],
  engine: ClickHouseEngines.MergeTree,
});
TS

cat > README.md <<'MD'
# Engine migration workspace (DR-enabled)

This Moose project models the existing `analytics.events` table. `migrate_with_deltas`
is enabled in `moose.config.toml`, so `moose generate migration` emits timestamped
delta files under `migrations/`. Edit `app/index.ts` to change the engine / ORDER BY,
generate a migration, and apply with `moose migrate --clickhouse-url $CLICKHOUSE_URL`.
Do NOT run `moose dev --dockerless` — ClickHouse is already running.
MD

echo "Seeded post-DR Moose workspace at $PROJECT_DIR (moose-lib@0.6.520, DR enabled)"
