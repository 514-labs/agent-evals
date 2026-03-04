# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

DEC Bench is a monorepo containing a Next.js web app (landing page, docs, leaderboard) and a Rust CLI for orchestrating benchmark eval containers. See `README.md` for full details.

### Running services

- **Web app**: `pnpm dev` from repo root starts the Next.js dev server at `http://localhost:3000` (uses Turbopack).
- **CLI**: `cd apps/cli && cargo build` builds the Rust CLI binary.

### Linting

- `next lint` does **not** exist in Next.js 16. Run ESLint directly: `cd apps/web && pnpm exec eslint . --max-warnings 0`.
- `pnpm --filter @workspace/ui lint` works.
- `@dec-bench/scenarios` and `@dec-bench/eval-core` lint scripts call `eslint` directly but do not declare it as a dependency — they will fail with `eslint: not found` under pnpm strict mode. This is a known codebase issue.
- Rust: `cd apps/cli && cargo check` and `cargo clippy`.

### Type checking

- `pnpm --filter @dec-bench/eval-core check-types`
- `pnpm --filter @dec-bench/scenarios check-types`

### Testing

- Rust CLI tests: `cd apps/cli && cargo test` (unit + integration + e2e, 19 tests total).
- No JS test framework is configured; the web app has no automated test suite.

### Rust toolchain

The default Rust version in the VM (1.83) is too old for the `time` crate's `edition2024` feature. Run `rustup default stable` to switch to the latest stable toolchain before building the CLI.

### pnpm build scripts

After `pnpm install`, build scripts for `esbuild`, `sharp`, and `core-js-pure` are ignored by default. The web app works without manually approving them; if Next.js image optimization issues arise, run `node node_modules/.pnpm/esbuild@*/node_modules/esbuild/install.js` manually.

### Docker

Docker is required only for building and running eval containers (`docker/build.sh`), not for web app or CLI development.
