---
name: dec-bench-local-test
description: Build and run DEC Bench scenarios locally using the Cargo-built CLI and Docker. Use when testing scenario changes, assertion fixes, entrypoint modifications, or harness configurations before pushing to CI.
---

# DEC Bench Local Test

Build and run DEC Bench scenarios locally. Use this when testing changes to eval infrastructure (entrypoint, assertions, harnesses, scenarios) before pushing to CI.

## Prerequisites

- Docker Desktop running
- Rust toolchain installed (for building the CLI)
- `ANTHROPIC_API_KEY` set in environment (only needed for full agent runs)

## Build the CLI

The `dec-bench` CLI is a Rust project at `apps/cli/`. Build it from the repo root:

```bash
cargo build -p dec-bench
```

Binary output: `target/debug/dec-bench`

Use `cargo build -p dec-bench --release` for an optimized build at `target/release/dec-bench`.

## Build a scenario image

```bash
cargo run -p dec-bench -- build \
  --scenario <scenario-id> \
  --harness <harness-id> \
  --agent claude-code \
  --model <model> \
  --version test
```

Or with a pre-built binary:

```bash
./target/debug/dec-bench build \
  --scenario <scenario-id> \
  --harness <harness-id>
```

Defaults: `--agent claude-code`, `--model claude-sonnet-4-20250514`, `--version v0.1.0`, `--harness base-rt`.

Under the hood, this calls `docker/build.sh` which builds four Docker layers: **base** -> **scenario** -> **harness** -> **agent**. Docker layer caching makes rebuilds fast when only the entrypoint or eval-core source changes.

**Dry run** (prints the plan without building):

```bash
cargo run -p dec-bench -- build --scenario <id> --harness <harness> --dry-run
```

**Image tag format:** `<scenario>.<harness>.<agent>.<model>.<version>`

## Run a full eval (with agent)

```bash
cargo run -p dec-bench -- run \
  --scenario <scenario-id> \
  --harness <harness-id> \
  --persona informed \
  --mode no-plan
```

Key flags:
- `--persona`: `baseline` or `informed` (selects prompt from `scenarios/<id>/prompts/`)
- `--mode`: `plan` or `no-plan`
- `--timeout <minutes>`: per-run timeout (0 = no limit)
- `--results-dir <path>`: output directory (default: `results`)
- `--skip-existing`: skip runs that already have result files
- `--dry-run`: list jobs without executing

Matrix mode (all scenario/agent combinations):

```bash
cargo run -p dec-bench -- run \
  --matrix \
  --agents claude-code:claude-sonnet-4-6 \
  --agents codex:gpt-5.4 \
  --parallel 4
```

## View results

```bash
cargo run -p dec-bench -- results --latest --scenario <scenario-id>
```

## Run assertions only (no agent)

This is the fast path for testing changes to `docker/base/entrypoint.sh`, `packages/eval-core/`, or scenario assertions. Override the entrypoint, set up test data, then run the assertion phase directly.

First build the image, then:

```bash
docker run --rm \
  --entrypoint /bin/bash \
  <image-tag> \
  -c '
# 1. Source scenario env
source /scenario/env.sh 2>/dev/null || true

# 2. Start ClickHouse with test data
cat > /tmp/ch-test.xml <<EOF
<?xml version="1.0"?>
<clickhouse>
  <logger><level>warning</level><log>/tmp/ch.log</log><errorlog>/tmp/ch.err.log</errorlog></logger>
  <http_port>${CLICKHOUSE_PORT:-8123}</http_port>
  <tcp_port>19000</tcp_port>
  <pid>/tmp/ch.pid</pid>
  <path>/var/lib/clickhouse/</path>
  <tmp_path>/var/lib/clickhouse/tmp/</tmp_path>
  <user_files_path>/var/lib/clickhouse/user_files/</user_files_path>
  <format_schema_path>/var/lib/clickhouse/format_schemas/</format_schema_path>
  <listen_host>127.0.0.1</listen_host>
  <mark_cache_size>524288000</mark_cache_size>
  <profiles><default/></profiles>
  <users><default><password></password><networks><ip>::/0</ip></networks><profile>default</profile><quota>default</quota><access_management>1</access_management></default></users>
  <quotas><default><interval><duration>3600</duration><queries>0</queries><errors>0</errors><result_rows>0</result_rows><read_rows>0</read_rows><execution_time>0</execution_time></interval></default></quotas>
</clickhouse>
EOF
su -s /bin/bash clickhouse -c "clickhouse-server --config-file=/tmp/ch-test.xml --daemon"
sleep 3

# 3. Create tables and insert test data
unset CLICKHOUSE_USER CLICKHOUSE_PASSWORD
CH="clickhouse-client --port 19000"
$CH -q "CREATE DATABASE IF NOT EXISTS <db>"
$CH -q "<CREATE TABLE ...>"
$CH -q "<INSERT ...>"

# 4. (Optional) Kill ClickHouse to test recovery
kill "$(cat /tmp/ch.pid)" 2>/dev/null; sleep 2

# 5. Run assertions
source /scenario/env.sh 2>/dev/null || true
export AGENT_EXIT_CODE=0 EVAL_WALL_CLOCK_SECONDS=10
export ASSERTION_LOG_PATH=/tmp/assertion-log.json
export CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
mkdir -p /output

eval "$(sed -n "/^ensure_clickhouse_for_assertions()/,/^}/p" /opt/dec-bench/entrypoint.sh)"
ensure_clickhouse_for_assertions

tsx /opt/dec-bench/eval-core/src/cli.ts /scenario/assertions

# 6. Print results
node -e "
  const d=JSON.parse(require(\"fs\").readFileSync(\"/tmp/assertion-log.json\",\"utf8\"));
  for(const[g,s]of Object.entries(d)){for(const[sec,a]of Object.entries(s)){const e=Object.entries(a);if(!e.length)continue;console.log(\"[\"+g+\"/\"+sec+\"]\");for(const[n,i]of e)console.log(\"  \"+(i.passed?\"PASS\":\"FAIL\")+\": \"+n+\" - \"+(i.message||(i.error||\"\").split(\"\\n\")[0]));}}
"
'
```

## Key Paths

### Repo

| Path | Purpose |
|------|---------|
| `apps/cli/` | Rust CLI (`Cargo.toml`, `src/main.rs`) |
| `docker/base/entrypoint.sh` | Container entrypoint (service startup, agent run, assertions) |
| `docker/base/Dockerfile` | Base image (Debian + Postgres + ClickHouse + Redpanda + Node) |
| `docker/build.sh` | Shell script called by `dec-bench build` |
| `packages/eval-core/src/` | Assertion runner TypeScript (context, runner, discovery) |
| `scenarios/<id>/` | Scenario dir (assertions/, prompts/, env.sh, init/, scenario.json) |
| `apps/web/data/harnesses/<id>.json` | Harness config with `installScript` |

### Inside the container

| Path | Purpose |
|------|---------|
| `/opt/dec-bench/entrypoint.sh` | Main orchestration script |
| `/opt/dec-bench/eval-core/src/` | Assertion runner TypeScript |
| `/scenario/` | Scenario files copied from `scenarios/<id>/` |
| `/etc/supervisord.conf` | Service config (empty = "infra installed not started") |
| `/var/lib/clickhouse/` | Default ClickHouse data directory |
| `/workspace/` | Agent workspace root |

## Common Scenarios

| Scenario | Harnesses | Notes |
|----------|-----------|-------|
| `foo-bar-create-analytics-table` | `base-rt`, `olap-for-swe` | Has `moose-user` persona for Moose testing |
| `foo-bar-moose-csv-ingest` | `olap-for-swe` | Moose-only, port 18123, has env.sh |
| `foo-bar-csv-ingest` | `base-rt`, `olap-for-swe` | Supervised ClickHouse |
| `foo-bar-table-layout` | `base-rt`, `olap-for-swe` | Supervised ClickHouse |

## Tips

- ClickHouse must run as the `clickhouse` user: `su -s /bin/bash clickhouse -c "..."`
- The slim Debian base has no `sudo`, `pkill`, or `ps` -- use PID files and `kill`
- When scenario `env.sh` sets `CLICKHOUSE_USER`/`CLICKHOUSE_PASSWORD`, unset them before using `clickhouse-client` with a passwordless test server
- Docker layer cache makes rebuilds fast -- only changed layers rebuild
- Use `--entrypoint /bin/bash` with `docker run` to get an interactive shell for debugging
