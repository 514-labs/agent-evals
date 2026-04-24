#!/bin/bash
# Launch all runs inside the container, using runner.container.sh (--bare).
set -uo pipefail

BASE=/app
# VARIANTS env var (space-separated) overrides the default list. Useful when
# adding new variants to the experiment without re-running the settled ones.
DEFAULT_VARIANTS=(deep signposted surfaced shallow positional flag atomic)
if [[ -n "${VARIANTS:-}" ]]; then
  # shellcheck disable=SC2206
  VARIANTS=($VARIANTS)
else
  VARIANTS=("${DEFAULT_VARIANTS[@]}")
fi
TASKS=(a b c d e combined)
CONCURRENCY=${CONCURRENCY:-6}
REPS=${REPS:-1}

mkdir -p "$BASE/runs"

JOBS=()
for v in "${VARIANTS[@]}"; do
  for t in "${TASKS[@]}"; do
    for r in $(seq 1 "$REPS"); do
      JOBS+=("$v $t $r")
    done
  done
done

echo "Launching ${#JOBS[@]} runs (${#VARIANTS[@]} variants x ${#TASKS[@]} tasks x $REPS reps), concurrency=$CONCURRENCY"
printf '[%s] start\n' "$(date +%H:%M:%S)"

printf '%s\n' "${JOBS[@]}" | \
  xargs -P "$CONCURRENCY" -I {} bash -c '
    args=({})
    bash '"$BASE"'/runner.container.sh "${args[0]}" "${args[1]}" "${args[2]}"
  '

printf '[%s] done\n' "$(date +%H:%M:%S)"
