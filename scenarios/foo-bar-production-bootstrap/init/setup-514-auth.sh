#!/usr/bin/env bash
set -euo pipefail

# Write 514 CLI credentials from environment variables forwarded into the
# container by run.rs. The 514 CLI reads auth from
# ~/.fiveonefour/credentials.toml. Mirrors scenarios/514-list-projects
# /init/setup-514-auth.sh — keep in sync.

CRED_DIR="${HOME}/.fiveonefour"
CRED_FILE="${CRED_DIR}/credentials.toml"

if [[ -z "${HOSTING_CLI_API_KEY:-}" ]]; then
  echo "WARNING: HOSTING_CLI_API_KEY is not set. 514 CLI auth will not be configured." >&2
  exit 0
fi

mkdir -p "${CRED_DIR}"

cat > "${CRED_FILE}" <<EOF
api_key = "${HOSTING_CLI_API_KEY}"
email = "${HOSTING_CLI_EMAIL:-}"
org_id = "${HOSTING_CLI_ORG_ID:-}"
EOF

chmod 600 "${CRED_FILE}"
echo "514 CLI credentials written to ${CRED_FILE}" >&2
