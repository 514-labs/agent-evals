#!/usr/bin/env bash
# Per-harness init for atlas-clickhouse. Mirrors base-rt's seed (primary
# ClickHouse on 8123/9000 with analytics.events + anchor tables, then torn
# down so the agent walks into a cold environment) and ALSO provisions a
# secondary "dev" ClickHouse on 8124/9001 that is left RUNNING. Atlas's
# `schema apply` / `migrate diff` require a live --dev-url to compute
# diffs; without it, the agent would have to spin up a second database
# themselves, which isn't the skill we're measuring.
set -euo pipefail

# ---------- Atlas login ----------
# Atlas's ClickHouse driver is gated — the free CLI refuses with "The
# clickhouse driver is available only to Atlas Pro users" unless logged
# in (Atlas Pro is free but requires an account). The host's ~/.atlas/
# directory is bind-mounted to /root/.atlas by the dec-bench runner;
# `atlas whoami` reads token.db from there and the session is shared.
# Fail fast if the mount is missing — the ClickHouse driver error message
# from `atlas schema inspect` is confusing and easy to misread as a code
# problem.
if ! atlas whoami >/dev/null 2>&1; then
  echo "ERROR: atlas is not logged in inside the container." >&2
  echo "       Expected ~/.atlas from the host to be mounted at /root/.atlas." >&2
  echo "       Run 'atlas login' on the host first, then re-run dec-bench." >&2
  exit 1
fi

# ---------- Primary ClickHouse (identical to base-rt) ----------
chown -R clickhouse:clickhouse /var/lib/clickhouse 2>/dev/null || true
mkdir -p /var/log/clickhouse-server
chown -R clickhouse:clickhouse /var/log/clickhouse-server 2>/dev/null || true

su -s /bin/bash clickhouse -c '/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml --daemon'

READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://localhost:8123/?query=SELECT%201" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "ERROR: primary ClickHouse never became ready on 8123" >&2
  tail -80 /var/log/clickhouse-server/clickhouse-server.log 2>/dev/null || true
  exit 1
fi

clickhouse-client --host localhost --port 9000 --multiquery <<'EOF'
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events (event_id, event_ts, event_type, user_id)
SELECT
  concat('evt_', leftPad(toString(number + 1), 6, '0')) AS event_id,
  toDateTime('2026-01-01 00:00:00')
    + toIntervalSecond(cityHash64(number) % (30 * 86400)) AS event_ts,
  ['pv','click','purchase','signup','logout'][(cityHash64(number + 1) % 5) + 1] AS event_type,
  concat('usr_', leftPad(toString((cityHash64(number + 2) % 500) + 1), 4, '0')) AS user_id
FROM numbers(10000);

CREATE TABLE analytics._seed_meta (
  key String,
  value String
) ENGINE = MergeTree ORDER BY key;

INSERT INTO analytics._seed_meta
SELECT key, value FROM (
  SELECT 'total_rows' AS key, toString(count()) AS value FROM analytics.events
  UNION ALL
  SELECT 'count_pv', toString(countIf(event_type = 'pv')) FROM analytics.events
  UNION ALL
  SELECT 'count_click', toString(countIf(event_type = 'click')) FROM analytics.events
  UNION ALL
  SELECT 'count_purchase', toString(countIf(event_type = 'purchase')) FROM analytics.events
  UNION ALL
  SELECT 'count_signup', toString(countIf(event_type = 'signup')) FROM analytics.events
  UNION ALL
  SELECT 'count_logout', toString(countIf(event_type = 'logout')) FROM analytics.events
);

CREATE TABLE analytics._seed_spotchecks (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree ORDER BY event_id;

INSERT INTO analytics._seed_spotchecks
SELECT event_id, event_ts, event_type, user_id
FROM analytics.events
WHERE event_id IN ('evt_000001', 'evt_002500', 'evt_005000', 'evt_007500', 'evt_010000');
EOF

# ---------- Dev ClickHouse (8124/9001, used by atlas --dev-url) ----------
# Atlas needs a live, clean ClickHouse to compute diffs against. We derive a
# second server config by sed'ing the default, point its data + log dirs at
# /var/lib/clickhouse-dev, and leave it running. Data dir is empty on every
# fresh container boot, which matches atlas's expectations.
DEV_CONFIG=/etc/clickhouse-server/config-dev.xml
DEV_DATA=/var/lib/clickhouse-dev
DEV_LOG=/var/log/clickhouse-dev

mkdir -p "$DEV_DATA" "$DEV_LOG"
chown -R clickhouse:clickhouse "$DEV_DATA" "$DEV_LOG"

cp /etc/clickhouse-server/config.xml "$DEV_CONFIG"
# `cp` produces a root-owned copy; clickhouse-server reads the config as the
# clickhouse user, which errors out with "Access to file denied" because
# /etc/clickhouse-server/ is 0750 root:clickhouse by default but the copy
# lands as 0640 root:root. Make it readable by the clickhouse group.
chown root:clickhouse "$DEV_CONFIG"
chmod 0640 "$DEV_CONFIG"

# Port remap — picked to avoid collision with base-rt primary (8123/9000/9004/9005/9009)
# and moose's 18123/19000 defaults.
#
# Data/log path remaps must be GLOBAL. The stock config.xml references
# /var/lib/clickhouse/ in at least 5 places (data path, tmp, user_files,
# format_schemas, access control path, custom disk caches, blob storage
# metadata, top-level domains). The access-control path in particular
# takes an exclusive lock; if dev CH shares it with a running primary,
# the dev daemon's child silently exits during init. Global substitution
# is simpler + more robust than enumerating every XML element.
sed -i \
  -e 's|<http_port>8123</http_port>|<http_port>8124</http_port>|' \
  -e 's|<tcp_port>9000</tcp_port>|<tcp_port>9001</tcp_port>|' \
  -e 's|<mysql_port>9004</mysql_port>|<mysql_port>9014</mysql_port>|' \
  -e 's|<postgresql_port>9005</postgresql_port>|<postgresql_port>9015</postgresql_port>|' \
  -e 's|<interserver_http_port>9009</interserver_http_port>|<interserver_http_port>9019</interserver_http_port>|' \
  -e 's|/var/lib/clickhouse/|/var/lib/clickhouse-dev/|g' \
  -e 's|/var/log/clickhouse-server/|/var/log/clickhouse-dev/|g' \
  "$DEV_CONFIG"

# Sanity: load-bearing remaps. Fail loud here rather than have the dev
# server silently refuse to start later.
for check in '<http_port>8124' '<tcp_port>9001' "<path>${DEV_DATA}/"; do
  grep -qF "$check" "$DEV_CONFIG" || {
    echo "ERROR: atlas dev config-dev.xml is missing expected token: $check" >&2
    exit 1
  }
done
# And no residual primary-path references should remain.
if grep -qE "/var/lib/clickhouse[^-]" "$DEV_CONFIG"; then
  echo "ERROR: dev config still references primary /var/lib/clickhouse/ path:" >&2
  grep -nE "/var/lib/clickhouse[^-]" "$DEV_CONFIG" >&2
  exit 1
fi

# --pid-file must point at a directory writable by the clickhouse user;
# /var/run (= /run) is root:root 0755 so passing `--pid-file=/var/run/…`
# makes the daemon init silently fail before the child writes any logs.
# /run/clickhouse-server/ is created by the clickhouse-server package and
# already owned by clickhouse:clickhouse.
su -s /bin/bash clickhouse -c "/usr/bin/clickhouse-server --config-file=${DEV_CONFIG} --pid-file=/run/clickhouse-server/clickhouse-dev.pid --daemon"

DEV_READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://localhost:8124/?query=SELECT%201" >/dev/null 2>&1; then
    DEV_READY=1
    break
  fi
  sleep 1
done
if [[ "${DEV_READY}" != "1" ]]; then
  echo "ERROR: dev ClickHouse never became ready on 8124" >&2
  tail -80 "${DEV_LOG}/clickhouse-server.err.log" 2>/dev/null || true
  tail -80 "${DEV_LOG}/clickhouse-server.log" 2>/dev/null || true
  exit 1
fi

# Pre-create the _atlas_dev database so `--dev-url .../_atlas_dev` resolves
# immediately; atlas will happily create/drop tables inside it.
# Must be POST — ClickHouse's HTTP GET interface is readonly and rejects DDL.
curl -fsS -X POST "http://localhost:8124/" --data "CREATE DATABASE IF NOT EXISTS _atlas_dev" >/dev/null

# ---------- Primary teardown only (dev stays running) ----------
# Find primary clickhouse-server PIDs by /proc/<pid>/comm (procps not
# installed). The dev server's pidfile is /var/run/clickhouse-dev.pid —
# read it first so we can exclude that PID from the kill set.
# Distinguish primary from dev by /proc/<pid>/cmdline, which includes the
# full --config-file path. The dev watchdog AND its forked worker both carry
# "config-dev.xml" in their cmdline; the primary's carries "config.xml" but
# not "config-dev.xml". This is the only reliable discriminator — PPID
# walking would work too but is more code for the same signal.
collect_primary_clickhouse_pids() {
  local proc_dir comm cmdline
  for proc_dir in /proc/[0-9]*; do
    comm=$(cat "$proc_dir/comm" 2>/dev/null) || continue
    case "$comm" in
      clickhouse-serv|clickhouse-server|clickhouse) ;;
      *) continue ;;
    esac
    # cmdline is NUL-separated; tr NULs to spaces so grep can match.
    cmdline=$(tr '\0' ' ' < "$proc_dir/cmdline" 2>/dev/null) || continue
    if [[ "$cmdline" == *"config-dev.xml"* ]]; then
      continue
    fi
    echo "${proc_dir##*/}"
  done
}

mapfile -t CH_PIDS < <(collect_primary_clickhouse_pids)
if (( ${#CH_PIDS[@]} > 0 )); then
  for pid in "${CH_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for _ in $(seq 1 15); do
    ANY_ALIVE=0
    for pid in "${CH_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then ANY_ALIVE=1; break; fi
    done
    (( ANY_ALIVE == 0 )) && break
    sleep 1
  done
  for pid in "${CH_PIDS[@]}"; do
    kill -KILL "$pid" 2>/dev/null || true
  done
fi

port_bound() {
  (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null && { exec 3<&-; exec 3>&-; return 0; }
  return 1
}

# Primary ports MUST be free; dev ports MUST still be bound.
STILL_BOUND_PRIMARY=""
for _ in $(seq 1 15); do
  STILL_BOUND_PRIMARY=""
  for port in 8123 9000; do
    if port_bound "$port"; then STILL_BOUND_PRIMARY="$port"; break; fi
  done
  [[ -z "$STILL_BOUND_PRIMARY" ]] && break
  sleep 1
done

if [[ -n "$STILL_BOUND_PRIMARY" ]]; then
  echo "ERROR: primary ClickHouse port $STILL_BOUND_PRIMARY still bound after teardown" >&2
  exit 1
fi

for port in 8124 9001; do
  if ! port_bound "$port"; then
    echo "ERROR: dev ClickHouse port $port is NOT bound — dev server died during primary teardown" >&2
    tail -80 "${DEV_LOG}/clickhouse-server.err.log" 2>/dev/null || true
    exit 1
  fi
done

echo "00-start-and-seed.sh (atlas-clickhouse): primary stopped (10k rows on disk), dev on :8124 / :9001 running"
