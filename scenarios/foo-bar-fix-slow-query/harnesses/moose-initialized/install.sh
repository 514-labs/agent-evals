#!/usr/bin/env bash
# Build-time hook: remove the [program:clickhouse] block from
# /etc/supervisord.conf so that the moose-initialized harness can run its
# own ClickHouse via `moose dev --dockerless` (Moose's native_infra) and
# OWN analytics.events end-to-end. The base-rt harness keeps the supervised
# ClickHouse since the agent there has no Moose-aware way to manage tables.
set -euo pipefail

if [[ ! -f /etc/supervisord.conf ]]; then
  echo "No /etc/supervisord.conf found; nothing to strip."
  exit 0
fi

python3 - <<'PY'
import re, pathlib
p = pathlib.Path("/etc/supervisord.conf")
text = p.read_text()
# Drop the entire [program:clickhouse] section (delimited by the next [section] or EOF).
new = re.sub(r"\[program:clickhouse\][^\[]*", "", text, flags=re.MULTILINE)
p.write_text(new)
print("Stripped [program:clickhouse] from supervisord.conf for moose-initialized.")
PY
