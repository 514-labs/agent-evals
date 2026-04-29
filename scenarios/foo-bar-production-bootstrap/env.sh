#!/usr/bin/env bash
# Sourced by docker/base/entrypoint.sh before every lifecycle phase.
# Keep side-effect-free: exports only, no network calls, no waits.
#
# This scenario doesn't run local services — it asks the agent to stand up a
# production deployment somewhere reachable. What "somewhere" looks like
# depends on the harness:
#
#   olap-for-swe — 514 CLI is installed and authed; agent should deploy the
#                  pinned `typescript-express` template. Endpoints
#                  are template-fixed (/ingest/Foo, /api/bar, /health).
#
#   base-rt      — control group. No platform tooling, no auth seeded. Agent
#                  has to find a way to deliver a public URL on its own.
#                  Endpoints are agent-declared via /workspace/.endpoints.json.

# ---------- Common across harnesses ----------

# Per-run unique project name so parallel runs don't collide.
export RUN_ID="${RUN_ID:-$(date +%s)}"
export DEPLOY_PROJECT_NAME="eval-bootstrap-${RUN_ID}"

# How long the agent has to reach a healthy deployment.
export DEPLOY_HEALTHY_TIMEOUT_SECONDS="${DEPLOY_HEALTHY_TIMEOUT_SECONDS:-600}"

# Where the assertions look for the agent-recorded deployment URL.
export DEPLOYED_URL_FILE="${DEPLOYED_URL_FILE:-/workspace/.deployed-url}"

# Optional agent-supplied endpoint overlay. The assertion runner reads this
# file (if it exists) on top of the EVAL_* defaults below to learn what the
# agent built. Shape:
#   { "ingest": "/events", "query": "/counts", "health": "/healthz" }
export ENDPOINTS_FILE="${ENDPOINTS_FILE:-/workspace/.endpoints.json}"

# ---------- Harness-specific ----------

case "${EVAL_HARNESS:-}" in
  olap-for-swe)
    # The 514 CLI is installed and authenticated via
    # harnesses/olap-for-swe/init/setup-514-auth.sh. Template is pinned for
    # this scenario — picking the right template is a separate concern.
    # typescript-express was chosen because:
    #   - prebuilt image is published and verified deployable
    #   - exposes /health, /ingest/Foo, /api/bar as auth-free routes the
    #     assertions can probe independently of any WebApp/admin gating.
    export DEPLOY_TEMPLATE="${DEPLOY_TEMPLATE:-typescript-express}"

    # Real deploys live at https://<project>.boreal.cloud. Anything
    # else (localhost, raw IPs, http://, *.vercel.app) is a mock or a dev
    # tunnel and shouldn't pass the gate.
    export EVAL_PRODUCTION_URL_PATTERN='^https://[a-z0-9][a-z0-9.-]*\.boreal\.cloud(/|$)'

    # typescript-express template-fixed endpoints. Agents on this harness
    # don't need to touch /workspace/.endpoints.json.
    export EVAL_INGEST_PATH="/ingest/Foo"
    export EVAL_QUERY_PATH="/api/bar?orderBy=totalRows&startDay=1&endDay=31&limit=31"
    export EVAL_HEALTH_PATH="/health"
    # `moose` mode parses the response as `{healthy: [...], unhealthy: [...]}`
    # and requires ClickHouse + Redpanda + Consumption API in the healthy set.
    export EVAL_HEALTH_CHECK="moose"

    # README is expected to record the pinned template ID as well as the
    # project name and URL.
    export EVAL_README_TEMPLATE_REQUIRED="1"
    ;;

  base-rt)
    # No platform tooling, no auth. The agent can pick any public hosting
    # provider it has credentials for, deploy by hand, etc. Production-URL
    # gate just rules out localhost/private-IPs/unencrypted traffic.
    #
    # Allow https + a public-looking hostname (at least two labels, ending
    # in a TLD-shaped suffix). Reject http://, localhost, *.local, raw IPv4,
    # and RFC1918 ranges.
    export EVAL_PRODUCTION_URL_PATTERN='^https://([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}(:[0-9]+)?(/|$)'

    # No fixed endpoint contract. The agent declares paths via
    # /workspace/.endpoints.json; if missing, the assertion runner falls
    # back to /events + /counts + /health (sensible REST defaults) so the
    # gate failures are about the deploy not existing, not about the
    # contract being unknown.
    export EVAL_INGEST_PATH="/events"
    export EVAL_QUERY_PATH="/counts"
    export EVAL_HEALTH_PATH="/health"
    # `http-200` mode just requires GET <health> to return 200. No body
    # shape requirement — the agent picked the framework.
    export EVAL_HEALTH_CHECK="http-200"

    # README only needs project name + URL on base-rt — there's no template.
    export EVAL_README_TEMPLATE_REQUIRED="0"
    ;;

  *)
    # Unknown harness — keep the assertions runnable for ad-hoc invocations
    # but don't pretend to know the contract.
    export EVAL_PRODUCTION_URL_PATTERN='^https://[a-z0-9.-]+(/|$)'
    export EVAL_INGEST_PATH="/ingest/Foo"
    export EVAL_QUERY_PATH="/api/bar"
    export EVAL_HEALTH_PATH="/health"
    export EVAL_HEALTH_CHECK="http-200"
    export EVAL_README_TEMPLATE_REQUIRED="0"
    ;;
esac
