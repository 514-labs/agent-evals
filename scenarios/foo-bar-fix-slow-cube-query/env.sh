#!/usr/bin/env bash
# Sourced by docker/base/entrypoint.sh before every lifecycle phase.
# Keep this side-effect free: exports only, no network calls, no waits.

# Cube-aggregation optimization is genuinely hard. The default Claude Code
# --max-turns of 100 is too tight: in our trial runs both harnesses hit the
# cap mid-iteration without converging. Give the agent room to keep
# exploring optimization candidates end-to-end against the canonical query.
export MAX_TURNS=2000
