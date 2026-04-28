#!/usr/bin/env bash
# Environment for the production-bootstrap scenario.
#
# This scenario does not run any local services — all infrastructure is
# created remotely on Boreal via the 514 CLI. The harness injects:
#
#   HOSTING_CLI_API_KEY  — Hosting API key scoped to the eval org
#   HOSTING_CLI_EMAIL    — eval-org service account
#   HOSTING_CLI_ORG_ID   — eval-org id
#
# Same shape as scenarios/514-list-projects/env.sh.

# Template pinned for this scenario. The scenario tests the deploy pipeline,
# not template selection — picking the right template is a separate concern.
# typescript-express was chosen because:
#   - prebuilt Boreal image is published and verified deployable
#   - exposes /health, /ingest/Foo, /api/bar as auth-free routes that the
#     assertions can probe independently of any WebApp/admin gating
export DEPLOY_TEMPLATE="${DEPLOY_TEMPLATE:-typescript-express}"

# Per-run unique project name so parallel runs don't collide on Boreal.
# The 'boreal-remote' harness should set RUN_ID; we fall back to a timestamp
# when running locally outside the harness.
export RUN_ID="${RUN_ID:-$(date +%s)}"
export DEPLOY_PROJECT_NAME="eval-bootstrap-${RUN_ID}"

# How long the agent has to reach a healthy deployment.
export DEPLOY_HEALTHY_TIMEOUT_SECONDS="${DEPLOY_HEALTHY_TIMEOUT_SECONDS:-600}"

# Where the assertions look for the captured deployed URL after the agent
# finishes. The agent is expected to write the deployment URL it verified
# against to this path so the assertion runner can probe it independently.
export DEPLOYED_URL_FILE="${DEPLOYED_URL_FILE:-/workspace/.deployed-url}"
