#!/usr/bin/env sh
set -eu

REPO="${DEC_BENCH_INSTALL_REPO:-514-labs/agent-evals}"
INSTALL_DIR="${DEC_BENCH_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${DEC_BENCH_INSTALL_VERSION:-latest}"
API_BASE="https://api.github.com/repos/$REPO/releases"

resolve_target() {
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os_slug="apple-darwin" ;;
    Linux) os_slug="unknown-linux-gnu" ;;
    *)
      echo "Unsupported operating system: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    arm64|aarch64) arch_slug="aarch64" ;;
    x86_64|amd64) arch_slug="x86_64" ;;
    *)
      echo "Unsupported architecture: $arch" >&2
      exit 1
      ;;
  esac

  printf "%s-%s" "$arch_slug" "$os_slug"
}

python_read_release_asset() {
  python3 - "$1" "$2" "$3" <<'PY'
import json
import pathlib
import sys

target = sys.argv[1]
want_checksum = sys.argv[2] == "checksum"
release = json.loads(pathlib.Path(sys.argv[3]).read_text())

for asset in release.get("assets", []):
    name = asset.get("name", "")
    if want_checksum:
        if name == "checksums.txt":
            print(asset.get("browser_download_url", ""))
            raise SystemExit(0)
        continue
    if target in name and name.endswith(".tar.gz"):
        print(asset.get("browser_download_url", ""))
        raise SystemExit(0)

raise SystemExit(1)
PY
}

python_sha256() {
  python3 - "$1" <<'PY'
import hashlib
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(hashlib.sha256(path.read_bytes()).hexdigest())
PY
}

python_expected_checksum() {
  python3 - "$1" "$2" <<'PY'
import pathlib
import sys

checksums = pathlib.Path(sys.argv[1]).read_text().splitlines()
asset_name = pathlib.Path(sys.argv[2]).name

for line in checksums:
    parts = line.strip().split()
    if len(parts) >= 2 and pathlib.Path(parts[-1]).name == asset_name:
        print(parts[0])
        raise SystemExit(0)

raise SystemExit(1)
PY
}

target="$(resolve_target)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

asset_url="${DEC_BENCH_INSTALL_URL:-}"
checksum_url="${DEC_BENCH_INSTALL_CHECKSUM_URL:-}"

if [ -z "$asset_url" ]; then
  if [ "$VERSION" = "latest" ]; then
    release_url="$API_BASE/latest"
  else
    release_url="$API_BASE/tags/$VERSION"
  fi

  release_json="$tmp_dir/release.json"
  curl -fsSL "$release_url" -o "$release_json"

  asset_url="$(python_read_release_asset "$target" asset "$release_json")" || {
    echo "Could not find a dec-bench archive for target $target in release $VERSION" >&2
    exit 1
  }
  checksum_url="$(python_read_release_asset "$target" checksum "$release_json" || true)"
fi

asset_name="$(basename "$asset_url")"
asset_path="$tmp_dir/$asset_name"
curl -fsSL "$asset_url" -o "$asset_path"

if [ -n "$checksum_url" ]; then
  checksum_path="$tmp_dir/checksums.txt"
  curl -fsSL "$checksum_url" -o "$checksum_path"
  expected="$(python_expected_checksum "$checksum_path" "$asset_name")" || {
    echo "Could not find checksum entry for $asset_name" >&2
    exit 1
  }
  actual="$(python_sha256 "$asset_path")"
  if [ "$expected" != "$actual" ]; then
    echo "Checksum verification failed for $asset_name" >&2
    exit 1
  fi
fi

mkdir -p "$INSTALL_DIR"
tar -xzf "$asset_path" -C "$tmp_dir"

if [ ! -f "$tmp_dir/dec-bench" ]; then
  echo "Archive did not contain a dec-bench binary" >&2
  exit 1
fi

install_path="$INSTALL_DIR/dec-bench"
mv "$tmp_dir/dec-bench" "$install_path"
chmod +x "$install_path"

echo "Installed dec-bench to $install_path"
"$install_path" --version

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo
    echo "Add $INSTALL_DIR to your PATH if it is not already there:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac
