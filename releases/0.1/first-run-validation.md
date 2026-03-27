# First-Run Validation

## Observed On This Machine

- `curl -fsSL https://decbench.ai/install.sh | sh` had already produced a working `dec-bench 0.1.0` binary in `~/.local/bin`.
- `dec-bench list` succeeds immediately and is now the recommended no-risk install smoke test.
- A full scored run could not be completed on this machine during validation because:
  - Docker was installed but the daemon was not running.
  - No agent API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CODEX_API_KEY`, or `CURSOR_API_KEY`) was exported.

## Tightening Applied

- `README.md` now puts `dec-bench list` directly in the quick-start path before API-key setup.
- `apps/web/content/docs/running-evals.mdx` now calls out `dec-bench list` as the install smoke test and separates it from the Docker-and-key-dependent build/run path.
- Public docs now use the current scenario counts: 48 total preview scenarios, including 36 Foo Bar scenarios.

## Remaining Requirement For A True End-To-End First Run

To validate the under-five-minute path fully, rerun the public quick-start with:

- Docker daemon running
- one valid agent API key exported
- a fresh shell where `dec-bench` is picked up from `PATH`
