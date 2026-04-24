# CLI Structure Experiment

Measures how CLI structure affects Claude Code agent efficiency. Five fake `moose`
CLIs with the same capability set but different command structures; the same set
of tasks is run against each; we measure tool calls, help reads, errors, tokens,
and cost.

## Variants

1. **Deep** -- 3-level namespacing (`moose project init`, `moose infra logs`, ...)
2. **Shallow** -- matches the real Moose CLI (mix of flat and nested)
3. **Positional** -- flat verbs with category as positional arg
4. **Flag** -- flat verbs with category as flag
5. **Atomic** -- every capability is its own kebab-case top-level verb

Important caveat: Shallow = real Moose, so the model has training-data priors
that the other four synthetic variants do not. Shallow numbers are biased
toward the optimistic end.

## Tasks

- `a` -- Init a new project
- `b` -- Search logs for a term
- `c` -- List tables
- `d` -- Seed ClickHouse from a remote DB
- `e` -- Check running processes
- `combined` -- All five in sequence (a, d, e, c, b)

## Run locally

```bash
docker build -t cli-structure-test:latest .
mkdir -p runs
docker run --rm \
  -v "$PWD/runs:/app/runs" \
  -e ANTHROPIC_API_KEY=sk-... \
  -e REPS=10 \
  -e CONCURRENCY=15 \
  cli-structure-test:latest
python3 parse.py "$PWD"
```

## Run on GitHub Actions

Workflow `.github/workflows/cli-structure-experiment.yml` runs the container
with `ANTHROPIC_API_KEY` from repo secrets and uploads traces as an artifact.
Trigger with `gh workflow run cli-structure-experiment.yml -f reps=10`.

## Wrappers are simulated

The `moose` CLIs under `variants/` are Python scripts that mirror the real
Moose surface area with canned help text and canned success output. They log
each invocation as a JSON line to `$MOOSE_LOG_PATH`. They do NOT invoke real
Moose. The only side effect is `init` creating a stub project directory so the
agent can `cd` into it (real artifact the fake otherwise lacked).
