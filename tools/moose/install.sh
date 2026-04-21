#!/usr/bin/env bash
# Install the Moose CLI at the requested version and pre-cache the version
# pinned by the `typescript-empty` template so `moose dev` never stalls
# downloading a second CLI on first use.
set -euo pipefail

VERSION="${1:?usage: install.sh <version>}"

bash -i <(curl -fsSL https://fiveonefour.com/install.sh) "moose@${VERSION}"
export PATH="$HOME/.local/bin:$HOME/.moose/bin:$PATH"

# Wrapper symlink, not direct binary — the wrapper auto-routes to the CLI
# version that matches the project's `@514labs/moose-lib` pin.
ln -sf "$HOME/.moose/bin/moose" /usr/local/bin/moose

probe_dir="$(mktemp -d)"
pushd "$probe_dir" >/dev/null
moose init __probe typescript-empty >/dev/null 2>&1
template_lib="$(node -e "console.log(require('./__probe/package.json').dependencies['@514labs/moose-lib'])" 2>/dev/null || true)"
popd >/dev/null

echo "Template pins moose-lib@${template_lib}"
if [[ -n "${template_lib}" && "${template_lib}" != "${VERSION}" ]]; then
  echo "Pre-caching moose CLI ${template_lib} to match template"
  bash -i <(curl -fsSL https://fiveonefour.com/install.sh) "moose@${template_lib}"
fi
rm -rf "$probe_dir"
