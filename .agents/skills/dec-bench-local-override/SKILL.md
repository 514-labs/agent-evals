---
name: dec-bench-local-override
description: Substitute a locally-built artifact — a binary (moose-cli, moose-lib, clickhouse, 514 CLI), a directory (Claude skills, template-packages), or a JSON fragment (MCP servers) — into a DEC Bench scenario image so changes can be tested end-to-end without cutting a release. Use when a developer says "test my local moose build", "try my patched moose-lib", "iterate on a skill inside dec-bench", "test a clickhouse patch against scenarios", "run moose-user scenarios against a patched binary", or "override <X> in a scenario".
---

# DEC Bench Local Override

Substitute a locally-built artifact into a DEC Bench scenario image so you can test changes before publishing a release of the underlying tool (moose, moose-lib, ClickHouse, a Claude skill, etc.).

The mechanism is a generic registry: each subdirectory of `tools/<name>/` is a tool module. The harness image installs the released version at build time; `dec-bench build --override <name>=<path>` stages a local artifact and swaps it in. `moose` is one worked example among several — everything below applies equally to any registered tool.

## Step 1: Confirm what the user wants to substitute

Before suggesting commands, ask these three questions — but skip any the user already answered in their opening message. Use the user's actual absolute paths in every command you emit; `/path/to/moose` and `/path/to/agent-evals` below are placeholders to substitute.

1. **Which artifact?** Offer the current registry. **Important:** if they pick `moose`, follow up by asking whether they want the three-way combo (`moose + moose-templates + moose-lib`), because a dev-built moose-cli reports `CLI_VERSION=0.0.1` and usually breaks without the other two — see the `moose` subsection below for details.

   | Name | Kind | What it replaces in the image |
   |------|------|-------------------------------|
   | `moose` | binary | `/usr/local/bin/moose`, `~/.moose/bin/moose`, every cached version under `~/.moose/versions/` |
   | `moose-lib` | tarball (`.tgz`) | Staged at `/opt/moose-lib/moose-lib.tgz`; also rewrites TS templates' `@514labs/moose-lib` dep to `file:/opt/moose-lib/moose-lib.tgz` when `moose-templates` is also overridden |
   | `moose-templates` | directory (`manifest.toml` + `*.tgz`) | Rsyncs into `/usr/template-packages/` |
   | `clickhouse` | binary | Every cached ClickHouse under `~/.moose/binaries/clickhouse/*/*/clickhouse-common-static-*/usr/bin/clickhouse` |
   | `514` | binary | `~/.local/bin/514` and `/usr/local/bin/514` |
   | `claude-skills` | directory | Rsyncs into `$HOME/.claude/skills/` (same-named skills overwrite; defaults from `514 agent init` preserved) |
   | `claude-mcp` | JSON fragment `{"mcpServers": {...}}` | Merged into `$HOME/.claude.json` (same-named servers overwrite; defaults preserved) |
   | (something else) | — | See "Extending the registry" at the bottom |

2. **Where is the local artifact?** Absolute path. Format depends on the artifact:
   - binary: a single executable file (e.g. `/path/to/moose/target/aarch64-unknown-linux-gnu/release/moose-cli`)
   - tarball: a `.tgz` produced by `pnpm pack` (e.g. `/path/to/moose/packages/ts-moose-lib/514labs-moose-lib-0.0.2.tgz`)
   - directory: a path containing the expected layout (e.g. `/path/to/moose/template-packages` with `manifest.toml` + `*.tgz`)
   - JSON fragment: a file whose top-level shape is `{"mcpServers": { "<name>": {...} }}`

3. **Which scenario(s)?** Offer three modes:
   - single: `--scenario foo-bar-csv-ingest`
   - full moose sweep: `scripts/run-moose-user-patched.sh` (5 moose scenarios × concurrency 2)
   - just re-run without rebuilding: `scripts/run-moose-user-patched-images-only.sh`

## Mental model

The harness layer of a scenario image runs each harness's `toolInstalls[]` through `tools/<name>/install.sh <version>`, then appends the harness's `postInstallScript`. When you pass `--override <name>=<path>`, the CLI stages the local artifact under `docker/.tmp/overrides/<name>`, Docker copies it to `/tmp/overrides/` inside the harness layer, and `docker/harness/apply-overrides.sh` dispatches to `/opt/dec-bench/tools/<name>/override.sh` which swaps the staged artifact into place. The `tools/` directory **is** the registry — no central case statement.

Prereqs for any path:
- Docker Desktop running with ~50 GB free (each scenario image is ~5 GB)
- `cargo build -p dec-bench` has produced `./target/debug/dec-bench`
- **`pnpm`** (the repo's package manager) for any JS/TS packaging step

## Step 2: Tool-specific procedure

Pick the subsection that matches the answer to question 1.

### `moose` — substitute a local moose-cli binary

The binary inside the image must be a **Linux** executable matching the container arch (almost always `aarch64-unknown-linux-gnu` on Apple Silicon, `x86_64-unknown-linux-gnu` on Intel/Linux hosts). A macOS Mach-O binary won't run — cross-compile first.

> **Important**: a dev-built moose-cli reports `CLI_VERSION=0.0.1`, which flips `framework-cli/src/cli/routines/templates.rs` onto the local-templates lookup path **and** breaks the registry-pinned `@514labs/moose-lib` ABI. When overriding `moose`, you almost always need `moose-templates` **and** `moose-lib` overrides together. Ask the user whether they want the three-way combo before proceeding with just `moose`.

**Cross-compile (sub-guide for first-time setup):**

```bash
# One-time: install cross
cargo install cross --git https://github.com/cross-rs/cross

# In the moose repo. The env vars are required — see table below for why.
cd /path/to/moose
CC=aarch64-linux-gnu-gcc \
CXX=aarch64-linux-gnu-g++ \
AR=aarch64-linux-gnu-ar \
OPENSSL_NO_VENDOR=1 \
OPENSSL_LIB_DIR=/usr/lib/aarch64-linux-gnu \
OPENSSL_INCLUDE_DIR=/usr/include \
OPENSSL_STATIC=1 \
cross build --release -p moose-cli --target aarch64-unknown-linux-gnu --features rdkafka/cmake-build
# Binary lands at target/aarch64-unknown-linux-gnu/release/moose-cli
```

Env vars, why each is needed:

| Var | Reason |
|-----|--------|
| `CC`, `CXX`, `AR` | `rdkafka-sys` runs `librdkafka`'s autoconf `./configure`, which reads bare `$CC` — not cargo's target-qualified `CC_aarch64_unknown_linux_gnu`. Without them configure defaults to the host `gcc` (x86_64) and ld fails with `cannot find -lcrypto`. |
| `OPENSSL_NO_VENDOR=1` | Opts out of openssl-sys's vendored build (OpenSSL 3.x strips deprecated symbols like `SSL_get_peer_certificate` that `librdkafka` still calls). The Cargo.toml `features = ["vendored"]` stays untouched — this env var is the documented opt-out. |
| `OPENSSL_LIB_DIR` + `OPENSSL_INCLUDE_DIR` | Tell openssl-sys where to find the system libssl 1.1 inside the cross container (Debian multiarch layout). |
| `OPENSSL_STATIC=1` | Static-link libssl so the resulting binary has no runtime libssl dep. |

The full Cross.toml recipe — base image (`ghcr.io/cross-rs/aarch64-unknown-linux-gnu:main`), apt packages, sysroot symlinks — lives at `/path/to/moose/Cross.toml`.

**Build + run:**

```bash
cd /path/to/agent-evals
./target/debug/dec-bench build \
  --scenario <scenario-id> \
  --harness olap-for-swe \
  --version v0.2.0-patched \
  --override moose=/path/to/moose/target/aarch64-unknown-linux-gnu/release/moose-cli

./target/debug/dec-bench run \
  --scenario <scenario-id> \
  --harness olap-for-swe \
  --persona informed \
  --version v0.2.0-patched
```

**Verify it landed:**

```bash
docker run --rm --entrypoint bash <image-tag> -c '
  md5sum /usr/local/bin/moose ~/.moose/bin/moose ~/.moose/versions/stable/*/moose
'
# All four md5 hashes should match your local binary's md5.
```

### `moose-lib` — substitute a local moose-lib build

```bash
cd /path/to/moose/packages/ts-moose-lib
pnpm build         # produces dist/
pnpm pack          # produces 514labs-moose-lib-<version>.tgz in cwd
```

Use the output tarball:

```bash
./target/debug/dec-bench build \
  --scenario <id> --harness olap-for-swe --version v0.2.0-patched \
  --override moose-lib=/path/to/moose/packages/ts-moose-lib/514labs-moose-lib-<ver>.tgz
```

Side-effect worth knowing: if `moose-templates` is **also** overridden in the same build, `tools/moose-lib/override.sh` rewrites each TS template's `package.json` to `"@514labs/moose-lib": "file:/opt/moose-lib/moose-lib.tgz"` so the scaffolded project picks up the patched lib instead of `npm install`ing the registry version. Ordering is guaranteed by `tools/moose-lib/.order = 60` running after `tools/moose-templates/.order = 40`.

### `moose-templates` — substitute a local templates directory

```bash
cd /path/to/moose
pnpm install --filter=@repo/scripts
node scripts/package-templates.js
# Produces template-packages/ with manifest.toml + typescript*.tgz + python*.tgz ...
```

Use the output directory:

```bash
--override moose-templates=/path/to/moose/template-packages
```

Verify: `docker run --rm --entrypoint bash <image> -c 'ls /usr/template-packages | head'`.

### `clickhouse` — substitute a local ClickHouse binary

```bash
--override clickhouse=/path/to/clickhouse-linux-aarch64/usr/bin/clickhouse
```

Binary must be Linux + matching arch. The override replaces every cached ClickHouse under `~/.moose/binaries/clickhouse/...`.

### `514` — substitute a local 514 CLI binary

```bash
--override 514=/path/to/514-binary
```

### `claude-skills` — iterate on Claude skills without cutting a CLI release

Source layout: a directory that mirrors `~/.claude/skills/`, i.e. one subdirectory per skill with its `SKILL.md`:

```
/path/to/my-skills/
  my-skill-name/
    SKILL.md
```

```bash
--override claude-skills=/path/to/my-skills
```

Overwrites same-named skills in the image; defaults from `514 agent init` are preserved.

### `claude-mcp` — add or override MCP server entries

Source: a JSON file whose top-level shape is:

```json
{
  "mcpServers": {
    "my-server": { "type": "http", "url": "http://localhost:9999/mcp" }
  }
}
```

```bash
--override claude-mcp=/path/to/mcp-fragment.json
```

Deep-merged into `$HOME/.claude.json`; same-named entries overwrite; defaults preserved.

## Step 3: Run the scenario

### Single scenario

```bash
./target/debug/dec-bench build --scenario <id> --harness <h> --version v0.2.0-patched --override ...
./target/debug/dec-bench run --scenario <id> --harness <h> --persona <p> --version v0.2.0-patched --timeout 20
```

### Full moose sweep (5 scenarios, concurrency 2)

The canonical full-sweep for moose-family overrides:

```bash
./scripts/run-moose-user-patched.sh \
  /path/to/moose/target/aarch64-unknown-linux-gnu/release/moose-cli \
  /path/to/moose/template-packages \
  /path/to/moose/packages/ts-moose-lib/514labs-moose-lib-<ver>.tgz
```

This builds images for all 5 moose scenarios with the three overrides, then runs them at concurrency 2. Defined in `scripts/run-moose-user-patched.sh`; the script is moose-focused — for other tools, compose your own `for` loop around `dec-bench build` + `dec-bench run`.

### Re-run without rebuilding

If the images from a prior build with the same `--version` still exist:

```bash
./scripts/run-moose-user-patched-images-only.sh
```

## Extending the registry with a new tool

If the user answered "something else" to question 1, they need a new tool module. Procedure:

1. `mkdir tools/<name>`
2. For a **binary tool** (install + override) — copy the shape from `tools/moose/`:
   - `tools/<name>/install.sh <version>` — installs the released version at harness build time
   - `tools/<name>/override.sh <source>` — replaces the installed artifact at `--override` time
3. For an **artifact-only tool** (override-only) — copy the shape from `tools/claude-skills/`:
   - `tools/<name>/override.sh <source>` only
4. If the new tool needs to run after or before another override, add `tools/<name>/.order` (integer; `moose-templates` is 40, `moose-lib` is 60; default is 50).
5. If the tool should be **installed at harness build time** (not just override-available), add it to the harness JSON's `toolInstalls[]` with its version:
   ```json
   "toolInstalls": [
     { "name": "<new-tool>", "version": "1.2.3" }
   ]
   ```
6. Build + test: `./target/debug/dec-bench build --scenario <id> --harness <h> --override <new-tool>=/path`.

## Troubleshooting

Real failures we hit this week while validating this workflow:

- **`cannot find -lcrypto` during cross-build** — the `CC`/`CXX`/`AR` env vars aren't set. `rdkafka-sys`'s autoconf sub-process reads bare env vars, not cargo's target-qualified ones. Set all three.
- **`undefined reference to SSL_get_peer_certificate` during link** — openssl-sys vendored OpenSSL 3.x which stripped the deprecated symbol; `librdkafka` still calls it. Set `OPENSSL_NO_VENDOR=1` + `OPENSSL_LIB_DIR=/usr/lib/aarch64-linux-gnu` + `OPENSSL_INCLUDE_DIR=/usr/include` so the system libssl 1.1 (which has the symbol) is used instead.
- **ClickHouse inside the scenario errors with `NOT_ENOUGH_SPACE`** — Docker Desktop VM disk is full. `docker builder prune -af` reclaims build cache; `docker image prune -af` removes unused images (protect your patched images by keeping them tagged with a unique `--version` like `v0.2.0-patched` and filtering the prune).
- **`moose init` fails with "Local manifest not found"** — dev-build moose-cli (`CLI_VERSION=0.0.1`) requires a local template manifest at `/usr/template-packages/manifest.toml`. Add `--override moose-templates=/path/to/moose/template-packages` alongside the `moose` override.
- **Image built with overrides but scenario runs against stock moose anyway** — `--version` mismatch between `build` and `run`. The image tag is `<scn>.<harness>.<agent>.<model>.<version>`, so the `run` command must pass the same `--version` you built with.

## Key paths

| Path | What's there |
|------|--------------|
| `tools/` | The registry. Each subdirectory is one substitutable tool. |
| `tools/<name>/install.sh` | Installs the released version at harness build. |
| `tools/<name>/override.sh` | Handler that swaps the staged local artifact into place. |
| `tools/<name>/.order` | Optional ordering hint (integer). |
| `scripts/run-moose-user-patched.sh` | Canonical full moose sweep (5 scenarios, concurrency 2). |
| `docker/harness/apply-overrides.sh` | Dispatcher — no per-tool knowledge; iterates `/tmp/overrides/*` and calls the matching `override.sh`. |
| `docker/harness/Dockerfile` | COPYs `tools/` into `/opt/dec-bench/tools/` and runs the dispatcher. |
| `docker/.tmp/harness-<harness>.sh` | Composed install script for the harness (generated per build, useful for debugging). |
| `apps/cli/src/commands/build.rs` | The `--override NAME=PATH` CLI surface + validation. |
| `apps/web/data/harnesses/<id>.json` | Harness definition (`toolInstalls[]` + `postInstallScript`, or legacy `installScript`). |

## Related skills

- `dec-bench-local-test` — general local-build + run workflow (without overrides).
- `dec-bench-run` — scenario execution flags, matrix mode, results inspection.
- `dec-bench-create-scenario` — authoring a new scenario from scratch.
