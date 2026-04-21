#!/usr/bin/env bash
# Stage a local @514labs/moose-lib tarball at a fixed in-image path, and, if
# the moose-templates override has already populated /usr/template-packages/,
# rewrite each TypeScript template to pull moose-lib from that file:// ref
# instead of the public npm version pinned in the template's package.json.
#
# With both overrides active the flow is:
#   scaffolded project — npm install @514labs/moose-lib@file:/opt/moose-lib/moose-lib.tgz
#
# If only this override is active (no moose-templates), we still stage the
# tarball — harmless, unused until a project explicitly references it.
#
# Expected source: a .tgz produced by `pnpm pack` in moose-0/packages/ts-moose-lib.
set -euo pipefail

SRC="${1:?usage: override.sh <source-tarball>}"

if [[ ! -f "$SRC" ]]; then
  echo "[override:moose-lib] source tarball not found: $SRC" >&2
  exit 1
fi

DEST_DIR="/opt/moose-lib"
DEST_TGZ="${DEST_DIR}/moose-lib.tgz"
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_TGZ"
chmod 0644 "$DEST_TGZ"

echo "[override:moose-lib] staged $(stat -c%s "$DEST_TGZ" 2>/dev/null || wc -c <"$DEST_TGZ") bytes at ${DEST_TGZ}"

# If moose-templates has staged TS templates, rewrite their moose-lib dep
# to point at our tarball. Otherwise exit — moose-lib is staged for any
# project that wants to reference it directly.
TEMPLATES_DIR="/usr/template-packages"
if [[ ! -d "$TEMPLATES_DIR" ]]; then
  echo "[override:moose-lib] ${TEMPLATES_DIR} not present — skipping template rewrite (install moose-templates override if needed)"
  exit 0
fi

rewritten=0
for tgz in "$TEMPLATES_DIR"/typescript*.tgz; do
  [[ -f "$tgz" ]] || continue
  staging="$(mktemp -d)"
  tar -xzf "$tgz" -C "$staging"
  pkg_json="$staging/package.json"
  if [[ ! -f "$pkg_json" ]]; then
    rm -rf "$staging"
    continue
  fi

  # Rewrite @514labs/moose-lib dep in dependencies+devDependencies. Using node
  # rather than sed keeps us resilient to ordering and whitespace drift.
  PKG_JSON="$pkg_json" DEST_TGZ="$DEST_TGZ" node - <<'NODE' || { rm -rf "$staging"; continue; }
const fs = require('fs');
const pkgPath = process.env.PKG_JSON;
const destTgz = process.env.DEST_TGZ;
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let changed = false;
for (const key of ['dependencies', 'devDependencies']) {
  const deps = pkg[key];
  if (!deps || !deps['@514labs/moose-lib']) continue;
  if (deps['@514labs/moose-lib'] !== `file:${destTgz}`) {
    deps['@514labs/moose-lib'] = `file:${destTgz}`;
    changed = true;
  }
}
if (!changed) process.exit(2);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE
  rc=$?
  # rc=0 means rewrote; rc=2 means no change needed; others → skip repack.
  if [[ "$rc" -eq 0 ]]; then
    # Strip any lockfiles so npm/pnpm regenerate against the new dep.
    rm -f "$staging/pnpm-lock.yaml" "$staging/package-lock.json"
    ( cd "$staging" && tar -czf "$tgz.new" --exclude node_modules . )
    mv "$tgz.new" "$tgz"
    rewritten=$((rewritten + 1))
  fi
  rm -rf "$staging"
done

echo "[override:moose-lib] rewrote moose-lib dep in ${rewritten} template(s)"
