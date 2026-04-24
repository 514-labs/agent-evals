#!/usr/bin/env python3
"""Parse all run traces + moose.log files.

Aggregates per (variant, task) cell across reps, reporting mean and standard error.
Runs can live at runs/<variant>/<task>/trace.jsonl (legacy n=1) or
runs/<variant>/<task>/rep<N>/trace.jsonl (n>=2).
"""
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/cli-structure-test")
RUNS = BASE / "runs"

VARIANTS = ["deep", "signposted", "surfaced", "shallow", "positional", "flag", "atomic"]
TASKS = ["a", "b", "c", "d", "e", "combined"]

TASK_CANONICAL = {
    "a": {"init"},
    "b": {"logs"},
    "c": {"ls"},
    "d": {"seed:clickhouse"},
    "e": {"ps"},
    "combined": {"init", "seed:clickhouse", "ps", "ls", "logs"},
}


def parse_moose_log(path: Path):
    if not path.exists():
        return []
    out = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return out


def parse_trace(path: Path):
    if not path.exists():
        return None
    events = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass

    tool_calls = 0
    for e in events:
        if e.get("type") != "assistant":
            continue
        msg = e.get("message") or {}
        for item in msg.get("content") or []:
            if item.get("type") == "tool_use":
                tool_calls += 1

    result = next((e for e in events if e.get("type") == "result"), None)
    if result:
        num_turns = result.get("num_turns", 0)
        duration_ms = result.get("duration_ms", 0)
        duration_api_ms = result.get("duration_api_ms", 0)
        usage = result.get("usage", {}) or {}
        total_cost_usd = result.get("total_cost_usd", 0.0)
        is_error = result.get("is_error", False)
        terminal_reason = result.get("terminal_reason", "")
    else:
        num_turns = duration_ms = duration_api_ms = total_cost_usd = 0
        usage = {}
        is_error = True
        terminal_reason = "no_result"

    return {
        "num_turns": num_turns,
        "tool_calls": tool_calls,
        "duration_ms": duration_ms,
        "duration_api_ms": duration_api_ms,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cache_read_tokens": usage.get("cache_read_input_tokens", 0),
        "cache_creation_tokens": usage.get("cache_creation_input_tokens", 0),
        "total_cost_usd": total_cost_usd,
        "terminal_reason": terminal_reason,
        "is_error": is_error,
    }


def analyze_run(run_dir: Path, variant: str, task: str, rep: int):
    trace = parse_trace(run_dir / "trace.jsonl")
    moose_entries = parse_moose_log(run_dir / "moose.log")

    help_invocations = sum(
        1 for m in moose_entries if str(m.get("result", "")).startswith("help:")
    )
    errors = sum(
        1 for m in moose_entries if str(m.get("result", "")).startswith("error:")
    )
    matched_caps = [
        m["result"].split("matched:", 1)[1]
        for m in moose_entries
        if str(m.get("result", "")).startswith("matched:")
    ]
    total_moose_invocations = len(moose_entries)

    argv_counts = Counter(tuple(m.get("argv", [])) for m in moose_entries)
    repeated = sum(n - 1 for n in argv_counts.values() if n > 1)

    required = TASK_CANONICAL[task]
    success = required.issubset(set(matched_caps))

    wall = None
    timing_path = run_dir / "timing.json"
    if timing_path.exists():
        try:
            wall = json.loads(timing_path.read_text()).get("wall_seconds")
        except json.JSONDecodeError:
            pass

    base = {
        "variant": variant,
        "task": task,
        "rep": rep,
        "success": success,
        "help_invocations": help_invocations,
        "errors": errors,
        "repeated_actions": repeated,
        "total_moose_invocations": total_moose_invocations,
        "wall_seconds": wall,
    }
    if trace:
        base.update(trace)
    return base


def collect_runs():
    rows = []
    for v in VARIANTS:
        for t in TASKS:
            cell_dir = RUNS / v / t
            if not cell_dir.exists():
                continue
            rep_dirs = sorted(d for d in cell_dir.iterdir() if d.is_dir() and d.name.startswith("rep"))
            if rep_dirs:
                for rd in rep_dirs:
                    rep = int(rd.name[3:])
                    rows.append(analyze_run(rd, v, t, rep))
            elif (cell_dir / "trace.jsonl").exists():
                rows.append(analyze_run(cell_dir, v, t, 1))
    return rows


def mean_se(values):
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mu = sum(values) / n
    if n == 1:
        return mu, 0.0
    var = sum((x - mu) ** 2 for x in values) / (n - 1)
    se = math.sqrt(var / n)
    return mu, se


def fmt_ms(m, s):
    if s == 0.0:
        return f"{m:.2f}"
    return f"{m:.2f}±{s:.2f}"


def aggregate(rows):
    cells = defaultdict(list)
    for r in rows:
        cells[(r["variant"], r["task"])].append(r)

    agg = {}
    for (v, t), runs in cells.items():
        n = len(runs)
        succ = sum(1 for r in runs if r["success"])
        def vals(key):
            return [r.get(key) or 0 for r in runs]
        agg[(v, t)] = {
            "n": n,
            "success": succ,
            "tools": mean_se(vals("tool_calls")),
            "turns": mean_se(vals("num_turns")),
            "help": mean_se(vals("help_invocations")),
            "errors": mean_se(vals("errors")),
            "repeat": mean_se(vals("repeated_actions")),
            "cost_usd": mean_se(vals("total_cost_usd")),
            "api_s": mean_se([(x or 0) / 1000 for x in vals("duration_api_ms")]),
            "wall_s": mean_se(vals("wall_seconds")),
            "in_tok": mean_se(vals("input_tokens")),
            "out_tok": mean_se(vals("output_tokens")),
        }
    return agg


def table_cells(agg, tasks):
    print("\n## Per-cell (mean +/- SE across reps)\n")
    header = f"{'variant':<10} | {'task':<10} | {'n':>3} | {'ok':>6} | {'tools':>13} | {'help':>11} | {'err':>11} | {'cost$':>13} | {'wall_s':>11}"
    print(header)
    print("-" * len(header))
    for v in VARIANTS:
        for t in tasks:
            a = agg.get((v, t))
            if not a:
                continue
            print(
                f"{v:<10} | {t:<10} | {a['n']:>3} | {a['success']}/{a['n']:<4} | "
                f"{fmt_ms(*a['tools']):>13} | {fmt_ms(*a['help']):>11} | "
                f"{fmt_ms(*a['errors']):>11} | {fmt_ms(*a['cost_usd']):>13} | "
                f"{fmt_ms(*a['wall_s']):>11}"
            )


def table_variant_rollup(agg, label, tasks):
    print(f"\n## {label} rollup (macro-avg across tasks {','.join(tasks)})\n")
    header = f"{'variant':<10} | {'success':>9} | {'tools':>14} | {'help':>12} | {'errors':>12} | {'cost$':>15} | {'api_s':>12}"
    print(header)
    print("-" * len(header))
    for v in VARIANTS:
        cells = [agg[(v, t)] for t in tasks if (v, t) in agg]
        if not cells:
            continue
        def macro(key):
            means = [c[key][0] for c in cells]
            return mean_se(means)
        total_n = sum(c["n"] for c in cells)
        total_succ = sum(c["success"] for c in cells)
        print(
            f"{v:<10} | {total_succ}/{total_n:<7} | "
            f"{fmt_ms(*macro('tools')):>14} | "
            f"{fmt_ms(*macro('help')):>12} | "
            f"{fmt_ms(*macro('errors')):>12} | "
            f"{fmt_ms(*macro('cost_usd')):>15} | "
            f"{fmt_ms(*macro('api_s')):>12}"
        )


def main():
    rows = collect_runs()
    out_json = BASE / "results.json"
    out_json.write_text(json.dumps(rows, indent=2))
    print(f"wrote {out_json} ({len(rows)} runs)")

    agg = aggregate(rows)

    table_cells(agg, TASKS)
    table_variant_rollup(agg, "Single tasks (a-e)", ["a", "b", "c", "d", "e"])
    table_variant_rollup(agg, "Combined task", ["combined"])


if __name__ == "__main__":
    main()
