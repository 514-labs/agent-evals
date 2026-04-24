#!/usr/bin/env python3
"""Generate charts for the CLI structure experiment report.

Reads results.json (produced by parse.py) and writes PNGs to charts/.
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    print("matplotlib required: pip install matplotlib", file=sys.stderr)
    sys.exit(1)

BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/cli-n10")
RESULTS = BASE / "results.json"
OUT = BASE / "charts"
OUT.mkdir(exist_ok=True)

# Slide-matching palette (warm cream bg, dark type, orange-red accents)
plt.rcParams.update({
    "figure.facecolor": "#F5F1E8",
    "axes.facecolor": "#F5F1E8",
    "savefig.facecolor": "#F5F1E8",
    "axes.edgecolor": "#2B2825",
    "axes.labelcolor": "#2B2825",
    "xtick.color": "#2B2825",
    "ytick.color": "#2B2825",
    "text.color": "#2B2825",
    "font.family": "DejaVu Sans",
    "font.size": 13,
    "axes.titlesize": 18,
    "axes.titleweight": "bold",
    "axes.labelsize": 13,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 150,
})

VARIANTS = ["deep", "signposted", "surfaced", "shallow", "positional", "flag", "atomic"]
VARIANT_LABELS = {
    "deep": "Deep",
    "signposted": "Signposted",
    "surfaced": "Surfaced",
    "shallow": "Shallow",
    "positional": "Positional",
    "flag": "Flag",
    "atomic": "Atomic",
}
# Color by structural family: structured red, hybrid green, shallow purple, flat blue
COLOR = {
    "deep": "#B13E1F",         # deep red
    "signposted": "#8A3220",   # darker red (Deep + help hint)
    "surfaced": "#1B7A2B",     # green (hybrid, highlighted as the candidate "best of both")
    "shallow": "#7851A9",      # purple (mixed real-Moose)
    "flag": "#D47148",         # burnt orange
    "positional": "#2E6FA7",   # blue
    "atomic": "#5095C6",       # light blue
}

with open(RESULTS) as f:
    rows = json.load(f)


def mean_se(values):
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mu = sum(values) / n
    if n == 1:
        return mu, 0.0
    var = sum((x - mu) ** 2 for x in values) / (n - 1)
    return mu, math.sqrt(var / n)


def by_variant_task(key, task_filter):
    out = {}
    for v in VARIANTS:
        vals = [r.get(key) or 0 for r in rows if r["variant"] == v and task_filter(r["task"])]
        out[v] = mean_se(vals)
    return out


def bar_chart(data_by_variant, title, ylabel, filename, show_err=True, highlight=None):
    fig, ax = plt.subplots(figsize=(8, 5))
    xs = list(range(len(VARIANTS)))
    means = [data_by_variant[v][0] for v in VARIANTS]
    errs = [data_by_variant[v][1] for v in VARIANTS]
    colors = [COLOR[v] for v in VARIANTS]

    bars = ax.bar(
        xs, means,
        yerr=errs if show_err else None,
        color=colors,
        edgecolor="#2B2825",
        linewidth=0.8,
        capsize=5,
        error_kw={"elinewidth": 1.2, "ecolor": "#2B2825"},
    )

    # Value labels on top of bars
    for bar, m, e in zip(bars, means, errs):
        y = bar.get_height() + (e if show_err else 0)
        label = f"{m:.2f}"
        ax.text(bar.get_x() + bar.get_width() / 2, y * 1.02, label,
                ha="center", va="bottom", fontsize=11)

    ax.set_xticks(xs)
    ax.set_xticklabels([VARIANT_LABELS[v] for v in VARIANTS])
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(axis="y", linestyle=":", alpha=0.4)
    ax.set_ylim(0, max(means) * 1.25 + max(errs) * 2)

    if highlight:
        # annotate best/worst
        best_i = min(range(len(means)), key=lambda i: means[i])
        worst_i = max(range(len(means)), key=lambda i: means[i])
        bars[best_i].set_edgecolor("#1B7A2B")
        bars[best_i].set_linewidth(2.2)
        bars[worst_i].set_edgecolor("#B13E1F")
        bars[worst_i].set_linewidth(2.2)

    fig.tight_layout()
    fig.savefig(OUT / filename)
    plt.close(fig)
    print(f"wrote {OUT / filename}")


def grouped_cost_chart():
    """Single vs Combined per-run cost, side by side."""
    fig, ax = plt.subplots(figsize=(9, 5.5))

    single = defaultdict(list)
    combined = defaultdict(list)
    for r in rows:
        if r["task"] == "combined":
            combined[r["variant"]].append(r.get("total_cost_usd", 0))
        else:
            single[r["variant"]].append(r.get("total_cost_usd", 0))

    xs = list(range(len(VARIANTS)))
    width = 0.38
    s_means = [mean_se(single[v])[0] for v in VARIANTS]
    s_errs = [mean_se(single[v])[1] for v in VARIANTS]
    c_means = [mean_se(combined[v])[0] for v in VARIANTS]
    c_errs = [mean_se(combined[v])[1] for v in VARIANTS]

    ax.bar([x - width/2 for x in xs], s_means, width, yerr=s_errs,
           label="Single task", color="#2E6FA7", capsize=4, error_kw={"elinewidth": 1.0, "ecolor": "#2B2825"})
    ax.bar([x + width/2 for x in xs], c_means, width, yerr=c_errs,
           label="Combined task (5 tasks)", color="#B13E1F", capsize=4, error_kw={"elinewidth": 1.0, "ecolor": "#2B2825"})

    # Amortization ratio annotations
    for i, v in enumerate(VARIANTS):
        ratio = c_means[i] / s_means[i] if s_means[i] > 0 else 0
        y = max(c_means[i] + c_errs[i], s_means[i] + s_errs[i]) * 1.08
        ax.text(i, y, f"{ratio:.1f}x", ha="center", va="bottom",
                fontsize=11, fontweight="bold", color="#B13E1F")

    ax.set_xticks(xs)
    ax.set_xticklabels([VARIANT_LABELS[v] for v in VARIANTS])
    ax.set_ylabel("Cost per run (USD)")
    ax.set_title("Cost amortization: Combined / Single ratio")
    ax.legend(frameon=False, loc="upper left")
    ax.grid(axis="y", linestyle=":", alpha=0.4)
    ax.set_ylim(0, max(c_means) * 1.35)

    fig.tight_layout()
    fig.savefig(OUT / "amortization.png")
    plt.close(fig)
    print(f"wrote {OUT / 'amortization.png'}")


def break_even_chart():
    """Projected cumulative cost vs N tasks per session."""
    fig, ax = plt.subplots(figsize=(8, 5))

    # Single-task cost per variant
    single_cost = {}
    # Combined-task-per-subtask cost: (combined_total - first_task_single) / 4
    # Model: first task costs single, each additional task costs `marginal`
    # From data: single ~ $s, combined of 5 tasks ~ $c
    # c = s + 4*m  =>  m = (c - s) / 4
    for v in VARIANTS:
        svals = [r.get("total_cost_usd", 0) for r in rows
                 if r["variant"] == v and r["task"] != "combined"]
        cvals = [r.get("total_cost_usd", 0) for r in rows
                 if r["variant"] == v and r["task"] == "combined"]
        if not svals or not cvals:
            continue  # variant absent from this dataset; skip
        s = sum(svals) / len(svals)
        c = sum(cvals) / len(cvals)
        m = (c - s) / 4
        single_cost[v] = (s, m)

    ns = list(range(1, 11))
    for v in VARIANTS:
        if v not in single_cost:
            continue
        s, m = single_cost[v]
        ys = [s + m * (n - 1) for n in ns]
        ax.plot(ns, ys, label=VARIANT_LABELS[v], color=COLOR[v], linewidth=2.5,
                marker="o", markersize=5)

    ax.set_xlabel("Tasks per session (N)")
    ax.set_ylabel("Projected cumulative cost per session (USD)")
    ax.set_title("Past ~4 CLI calls per agent session, structured CLIs beat flat ones")
    ax.legend(frameon=False, loc="upper left")
    ax.grid(axis="both", linestyle=":", alpha=0.4)
    ax.set_xticks(ns)

    # Vertical line at approximate break-even N
    ax.axvline(4, color="#B13E1F", linestyle="--", alpha=0.5, linewidth=1)
    ax.text(4.1, ax.get_ylim()[1] * 0.95, "N≈4", color="#B13E1F", fontsize=11, va="top")

    fig.tight_layout()
    fig.savefig(OUT / "break_even.png")
    plt.close(fig)
    print(f"wrote {OUT / 'break_even.png'}")


# Chart 1: Tools per single task
tools_single = by_variant_task("tool_calls", lambda t: t != "combined")
bar_chart(tools_single,
          "Single-task efficiency: tool calls per task",
          "Mean tool calls per task (n=50)",
          "single_task_tools.png",
          highlight=True)

# Chart 2: Tools on combined task
tools_combined = by_variant_task("tool_calls", lambda t: t == "combined")
bar_chart(tools_combined,
          "Combined-task efficiency: tool calls per session",
          "Mean tool calls per session (n=10, 5 tasks each)",
          "combined_task_tools.png",
          highlight=True)

# Chart 3: Cost amortization (combined/single ratio)
grouped_cost_chart()

# Chart 4: Errors per task (single + combined stacked? let's do combined since it's sharper)
errs_combined = by_variant_task("errors", lambda t: t == "combined")
bar_chart(errs_combined,
          "Combined-task errors: agent 'did you mean?' failures",
          "Mean errors per session",
          "errors.png",
          highlight=True)

# Chart 5: Break-even
break_even_chart()

print(f"\nAll charts in {OUT}")
