# DEC Bench (agent-evals)

@AGENTS.md

## Linear

- Project: [DecBench 0.2: enable 514 comparisons](https://linear.app/514/project/decbench-02-enable-514-comparisons-d7ac5dc4/issues)

## CLI Releases

The install script (`curl -fsSL https://decbench.ai/install.sh | sh`) serves binaries from the **latest GitHub release**. Merging CLI changes to `main` does NOT update what users get — a release must be cut.

- Release workflow: `.github/workflows/cli-release.yml`, triggers on `v*` tag push
- Tag must match `version` in `apps/cli/Cargo.toml`
- New release: `git tag v<version> && git push origin v<version>`
- Re-release (same version, newer main): delete release + tag, re-tag main, push
- After any change to `apps/cli/` that affects runtime behavior, cut a release
