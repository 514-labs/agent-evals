#!/usr/bin/env bash
set -euo pipefail

# Write 514 CLI credentials from environment variables injected by the container.
# The 514 CLI reads auth from ~/.fiveonefour/credentials.toml.
# Env vars HOSTING_CLI_API_KEY, HOSTING_CLI_EMAIL, HOSTING_CLI_ORG_ID are
# forwarded into the container by the dec-bench CLI (run.rs).

CRED_DIR="${HOME}/.fiveonefour"
CRED_FILE="${CRED_DIR}/credentials.toml"

if [[ -z "${HOSTING_CLI_API_KEY:-}" ]]; then
  echo "WARNING: HOSTING_CLI_API_KEY is not set. 514 CLI auth will not be configured."
  exit 0
fi

mkdir -p "${CRED_DIR}"

cat > "${CRED_FILE}" <<EOF
api_key = "${HOSTING_CLI_API_KEY}"
email = "${HOSTING_CLI_EMAIL:-}"
org_id = "${HOSTING_CLI_ORG_ID:-}"
EOF

chmod 600 "${CRED_FILE}"
echo "514 CLI credentials written to ${CRED_FILE}"
