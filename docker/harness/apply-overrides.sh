#!/usr/bin/env bash
# Dispatch each staged override in /tmp/overrides/<name> to the handler at
# /opt/dec-bench/tools/<name>/override.sh. The directory structure under
# tools/ is the registry — this script holds no per-tool knowledge.
#
# Ordering: each tool may optionally ship a plain-text `.order` file (integer,
# default 50). Lower runs first. Use when one override needs to land before
# another (e.g. moose-lib rewrites files that moose-templates must stage
# first).
set -euo pipefail

OVERRIDES_DIR="/tmp/overrides"
TOOLS_DIR="/opt/dec-bench/tools"

if [[ ! -d "$OVERRIDES_DIR" ]]; then
  exit 0
fi

# Collect (order, name, path) tuples, sort by order then name for stable output.
shopt -s nullglob dotglob
entries=()
for override in "$OVERRIDES_DIR"/*; do
  name="$(basename "$override")"
  if [[ "$name" == ".keep" || "$name" == ".gitkeep" ]]; then
    continue
  fi

  handler="$TOOLS_DIR/$name/override.sh"
  order_file="$TOOLS_DIR/$name/.order"
  if [[ -r "$order_file" ]]; then
    order="$(tr -d '[:space:]' <"$order_file")"
    [[ "$order" =~ ^-?[0-9]+$ ]] || order=50
  else
    order=50
  fi

  entries+=("${order}|${name}|${override}|${handler}")
done

if [[ ${#entries[@]} -eq 0 ]]; then
  echo "[apply-overrides] nothing to apply"
  exit 0
fi

applied=0
# Sort numeric asc, name asc. Field separator `|` keeps any weird names intact.
while IFS='|' read -r order name override handler; do
  if [[ ! -x "$handler" ]]; then
    echo "[apply-overrides] no executable handler at $handler for '$name' — skipping" >&2
    continue
  fi
  echo "[apply-overrides] applying '$name' (order=${order}) via $handler"
  "$handler" "$override"
  applied=$((applied + 1))
done < <(printf '%s\n' "${entries[@]}" | sort -t'|' -k1,1n -k2,2)

echo "[apply-overrides] applied ${applied} override(s)"
