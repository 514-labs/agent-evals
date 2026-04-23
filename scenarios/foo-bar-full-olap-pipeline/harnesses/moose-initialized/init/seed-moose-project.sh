#!/usr/bin/env bash
# Shared logic lives in tools/moose/seed-project.sh (baked into the image at
# /opt/dec-bench/tools/moose/seed-project.sh by the harness Dockerfile).
set -euo pipefail
bash /opt/dec-bench/tools/moose/seed-project.sh
