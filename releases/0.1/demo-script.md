# Demo Script and Video Plan

## Format

90-second narrated screencast. Terminal-focused. No slides.

## Target Audience

Developers who build or evaluate AI coding agents and want to see DEC Bench in action before cloning the repo.

## Shot List

### Shot 1: Install and List (0:00 - 0:20)

**Terminal commands:**
```bash
curl -fsSL https://decbench.ai/install.sh | sh
dec-bench list
```

**Narration:**
"DEC Bench evaluates AI agents on real data engineering tasks. Install the CLI in one line. `dec-bench list` shows all available scenarios -- each one is a self-contained challenge with real infrastructure."

**Visuals:** Terminal showing the installer completing, then the scenario table output.

### Shot 2: Build and Run (0:20 - 0:45)

**Terminal commands:**
```bash
dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest
```

**Narration:**
"Pick a scenario and build the eval image. This bundles Postgres, Redpanda, ClickHouse, and the agent runner into a single container. Run it, and the agent gets a prompt, real databases, and a time limit."

**Visuals:** Build output scrolling, then the run starting with agent output streaming. Time-lapse the middle of the run.

### Shot 3: Results and Scoring (0:45 - 1:05)

**Terminal commands:**
```bash
dec-bench results --latest --scenario foo-bar-csv-ingest
```

**Narration:**
"Results show five gates: Functional, Correct, Robust, Performant, Production. The agent cleared the first four gates and failed on Production -- it didn't use environment variables for credentials. The gated score reflects exactly how far it got."

**Visuals:** Results output showing gate breakdown, score, and assertion details.

### Shot 4: Audit (1:05 - 1:25)

**Terminal commands:**
```bash
dec-bench audit open --scenario foo-bar-csv-ingest --run-id <run-id>
```

**Narration:**
"Open the audit view to see the full trace: every command the agent ran, every assertion result, and a side-by-side comparison between runs. This is how you debug agent behavior and compare different models."

**Visuals:** Browser opening to the audit page. Quick scroll through the trace and gate breakdown.

### Shot 5: Call to Action (1:25 - 1:30)

**Narration:**
"DEC Bench is open source. Clone the repo, run a scenario, and tell us what's missing."

**Visuals:** Terminal with the GitHub URL and install command.

## Recording Notes

- **Resolution:** 1920x1080, 2x retina
- **Font size:** 16pt terminal, dark background
- **Speed:** Real-time for install and results. 4x speed for build and run middle sections.
- **Audio:** Single narrator, no background music. Record narration separately and sync.
- **Editing:** Cut dead time during Docker build. Show the interesting output, not the wait.
- **Length:** Hard cut at 90 seconds. If it runs long, cut the audit section to a quick flash rather than a walkthrough.

## Pre-Recording Checklist

- [ ] Docker running, images pre-pulled to avoid cold start delays
- [ ] `ANTHROPIC_API_KEY` exported
- [ ] Repo cloned fresh in a visible directory
- [ ] Terminal history cleared
- [ ] Previous results cleaned so `--latest` shows the correct run
