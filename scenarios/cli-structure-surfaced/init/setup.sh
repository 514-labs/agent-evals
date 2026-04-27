#!/usr/bin/env bash
# Installs the surfaced-variant fake `moose` wrapper on PATH and points
# its log file at /workspace/moose.log so the assertions can inspect every
# command the agent issued.
set -euo pipefail

mkdir -p /workspace
: > /workspace/moose.log

cp "$(dirname "$0")/moose" /usr/local/bin/moose
chmod +x /usr/local/bin/moose

# Make sure every shell (including the agent's) points the wrapper at the
# log path the assertions read.
mkdir -p /etc/profile.d
cat > /etc/profile.d/moose-log-path.sh <<'EOF'
export MOOSE_LOG_PATH=/workspace/moose.log
EOF
chmod 644 /etc/profile.d/moose-log-path.sh

# Belt and braces: emit the same export into common login files so non-login
# shells pick it up too.
for rc in /root/.bashrc /root/.profile /etc/bash.bashrc; do
  [[ -f "$rc" ]] || continue
  grep -q MOOSE_LOG_PATH "$rc" || echo 'export MOOSE_LOG_PATH=/workspace/moose.log' >> "$rc"
done

echo "moose wrapper (surfaced) installed at /usr/local/bin/moose"
echo "moose log will be written to /workspace/moose.log"
