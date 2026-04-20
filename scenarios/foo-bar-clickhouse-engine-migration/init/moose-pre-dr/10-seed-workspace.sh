#!/usr/bin/env bash
set -euo pipefail

# Scaffold a Moose project under /workspace/moose-project pinned to moose-lib@0.6.503.
# The project models the current DB state (MergeTree, ORDER BY event_id) so
# `moose generate migration` produces a meaningful diff only after the agent edits it.

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
    "@514labs/moose-lib": "0.6.503"
  }
}
JSON

# Use pre-installed moose-lib from /opt/dec-bench/moose instead of network install.
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

# moose.config.toml — point at the supervisord ClickHouse. No [features] block
# (migrate_with_deltas did not exist in 0.6.503).
cat > moose.config.toml <<CONF
[project]
name = "engine-migration"
language = "typescript"

[clickhouse_config]
db_name = "analytics"
user = "default"
password = ""
host = "localhost"
host_port = 8123
use_ssl = false
native_port = 9000
CONF

# TypeScript OlapTable definition matching the current DB schema.
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
# Engine migration workspace

This Moose project models the existing `analytics.events` table in ClickHouse.
Edit `app/index.ts` to change the table's engine / ORDER BY, then use
`moose generate` and `moose migrate` (pointed at `$CLICKHOUSE_URL`) to apply the
migration. ClickHouse is already running — do NOT run `moose dev --dockerless`.
MD

echo "Seeded pre-DR Moose workspace at $PROJECT_DIR (moose-lib@0.6.503)"
