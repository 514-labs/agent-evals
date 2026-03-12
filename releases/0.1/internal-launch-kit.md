# DEC Bench 0.1 Internal Launch Kit

## Slack Copy

### Short Post

```text
DEC Bench 0.1 is ready for internal use.

It gives us a CLI-first way to run real data engineering evals locally, inspect results, and open the audit UI for any run.

Start here:
curl -fsSL https://decbench.ai/install.sh | sh
dec-bench list

If you work on agents, harnesses, or evals, please run one scenario this week and reply here with anything confusing, broken, or missing.
```

### One-Liner

```text
DEC Bench 0.1 is live for internal use: install with curl -fsSL https://decbench.ai/install.sh | sh, run dec-bench list, and try one Foo Bar eval locally.
```

### Follow-Up Reply

```text
What's in 0.1: 36 Foo Bar scenarios, 3 harnesses, built-in Claude Code/Codex/Cursor runners, a one-line installer, localhost audit flow, and gated scoring.
```

### Reminder Nudge

```text
If you have 5 minutes this week, please install DEC Bench 0.1 and run one scenario. The fastest path is:
curl -fsSL https://decbench.ai/install.sh | sh
dec-bench list
```

## Positioning

DEC Bench is the fastest way for us to see how coding agents perform on real data engineering work. It is not a toy demo and it is not just a Docker image catalog. The product surface in `0.1` is the CLI:

- install
- list scenarios
- build and run evals
- inspect results
- open the audit UI

## What Shipped

- 36 Foo Bar scenarios
- 3 harness configurations
- built-in runners for Claude Code, Codex, and Cursor
- installable binaries for macOS and Linux
- stable installer at `https://decbench.ai/install.sh`
- localhost audit flow through the web app
- gated scoring across five sequential gates

## Who Should Try It First

- people building or testing coding agents
- people authoring evals or harnesses
- people comparing agent behavior across prompts, models, or tool access

## The Ask

Ask internal developers to do one concrete thing:

1. Install `dec-bench`.
2. Run `dec-bench list`.
3. Pick one Foo Bar scenario and run it locally.
4. Reply in the launch thread with friction, bugs, or missing docs.

## Suggested Starter Path

For the first run, keep it simple:

```bash
curl -fsSL https://decbench.ai/install.sh | sh
dec-bench list
dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest
dec-bench results --latest --scenario foo-bar-csv-ingest
```

If you want a broken-state scenario instead, start with `foo-bar-broken-connection`.

## FAQ

### Do I need Docker?

Yes. The CLI is the main workflow, but Docker is still the runtime underneath it.

### Is this public?

`v0.1.0` is released, but the launch motion right now is internal adoption and feedback.

### What should people try first?

Start with `foo-bar-csv-ingest` for a clean first run or `foo-bar-broken-connection` for a debugging-oriented task.

### What feedback matters most?

Anything that slows down first use: installer issues, unclear commands, missing docs, rough audit flow, or scenario friction.
