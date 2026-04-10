import { Fragment } from "react";
import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";
import { SideNote } from "../marketing/side-note";
import { GateAttritionChart } from "../charts/gate-attrition-chart";
import { CostScoreChart } from "../charts/cost-score-chart";
import { LiftChart } from "../charts/lift-chart";
import {
  computeGateAttrition,
  computeCostScore,
  computeLiftData,
  computeEfficiency,
  computeEfficiencyByGate,
  getAgentNames,
  formatAgent,
  AGENT_LABELS,
} from "../charts/aggregate";
import { getLeaderboardEntries, getScenarioTiers } from "@/data/results";

function formatCost(v: number): string {
  return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`;
}

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function formatTime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function ScenariosSection() {
  const entries = getLeaderboardEntries();
  const agents = getAgentNames(entries);
  const scenarioTiers = getScenarioTiers();
  const tierBuckets = {
    all: entries,
    "tier-1": entries.filter((e) => scenarioTiers[e.scenario] === "tier-1"),
    "tier-2": entries.filter((e) => scenarioTiers[e.scenario] === "tier-2"),
    "tier-3": entries.filter((e) => scenarioTiers[e.scenario] === "tier-3"),
  } as const;
  const gateAttritionByTier = Object.fromEntries(
    Object.entries(tierBuckets).map(([k, v]) => [k, computeGateAttrition(v)]),
  ) as Record<"all" | "tier-1" | "tier-2" | "tier-3", ReturnType<typeof computeGateAttrition>>;
  const countsByTier = Object.fromEntries(
    Object.entries(tierBuckets).map(([k, v]) => {
      const counts: Record<string, number> = {};
      for (const e of v) {
        const agent = formatAgent(e.agent);
        counts[agent] = (counts[agent] ?? 0) + 1;
      }
      return [k, counts];
    }),
  ) as Record<"all" | "tier-1" | "tier-2" | "tier-3", Record<string, number>>;
  const costScoreData = computeCostScore(entries, scenarioTiers);
  const liftDataByTier = Object.fromEntries(
    Object.entries(tierBuckets).map(([k, v]) => [k, computeLiftData(v, "base-rt", "classic-de")]),
  ) as Record<"all" | "tier-1" | "tier-2" | "tier-3", ReturnType<typeof computeLiftData>>;
  const efficiencyData = computeEfficiency(entries);
  const efficiencyByGate = computeEfficiencyByGate(entries);

  const numScenarios = new Set(entries.map((e) => e.scenario)).size;
  const numRuns = entries.length;
  const numAgents = agents.length;

  return (
    <section id="comparative-results" className="pt-10">
      <SectionHeading number={5} title="Comparative Results" />

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        This section presents the benchmark results in three parts. First, how
        agents perform across the five quality gates. Then, how quality trades
        off against cost and time. Finally, scenario-level detail.
      </p>

      {/* Task Completion */}
      <div className="mt-10">
        <h3 id="task-completion" className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          5.1 Task Completion
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          Attrition through the first four gates is gradual: 90% of runs clear
          G1 (functional), tapering to 78% at G4 (performant). The production
          gate is a cliff: only 15% of runs clear G5. Agent spreads at each
          gate are modest (7{"\u2013"}14pp) and mostly not statistically
          significant overall, but on tier-2 scenarios agent choice becomes
          significant at early gates (p = 0.03). Within Claude, model choice
          (Opus 4.6 vs Sonnet 4.6) shows no meaningful difference at any gate
          (p &gt; 0.3), with identical median normalized scores.
        </p>
        <div className="mt-4 border-l-2 border-[color:var(--accent)] pl-4">
          <p className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[1.2px] text-[color:var(--accent)]">
            Interpretation
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--accent)]">
            Of the 98 runs that reach G5, the single biggest failure
            is <code className="text-[11px]">uses_env_vars</code>: 67%
            hardcode database connection strings instead of reading from
            environment variables. Deep nesting (14%) and leftover debug
            artifacts (8%) account for most of the rest. The pattern is
            consistent: agents produce functional code that is brittle
            across environments and harder to maintain.
          </p>
        </div>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[1px] text-[color:var(--foreground)] block mb-1">
            Gate Attrition by Agent
          </span>
          <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] block mb-3">
            For each gate, the percentage of that agent&rsquo;s runs that
            cleared that gate level. Filter by scenario difficulty (T1
            easiest, T3 hardest).
          </span>
          <GateAttritionChart dataByTier={gateAttritionByTier} countsByTier={countsByTier} agents={agents} />
        </div>
        <SideNote>
          Computed over {numRuns} runs across {numScenarios} scenarios
          and {numAgents} agents. Both harness configurations (base-rt and
          classic-de) are combined.
        </SideNote>
      </div>

      {/* Harness Lift */}
      <div className="mt-10">
        <h3 id="harness-lift" className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          5.2 Harness Lift
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          The classic-de harness does not produce a statistically significant
          improvement in score when controlling for agent (stratified
          p = 0.08). Per-agent results diverge: Claude Code shows a
          significant score lift (0.973 to 0.987 median, p = 0.003) at
          higher cost ($0.25 to $0.32, p = 0.01). Codex trends similarly
          (0.973 to 0.987 median) with a large cost increase ($2.69 to
          $4.11) though neither reaches significance. Cursor moves in the
          opposite direction: slightly lower score (0.987 to 0.973) at
          slightly lower cost ($0.20 to $0.18), neither significant. Time
          is unaffected across all agents.
        </p>
        <div className="mt-4 border-l-2 border-[color:var(--accent)] pl-4">
          <p className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[1.2px] text-[color:var(--accent)]">
            Interpretation
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--accent)]">
            The harness helps Claude Code and Codex but slightly hurts
            Cursor{"\u2019"}s performance. In both directions
            the effect is small. The cost story mirrors the score story:
            agents that improve with the harness also spend more tokens
            using it, while Cursor spends slightly fewer.
          </p>
        </div>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[1px] text-[color:var(--foreground)] block mb-1">
            Harness Lift by Agent
          </span>
          <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] block mb-3">
            Median normalized score and median cost/time per agent under
            base-rt and classic-de harnesses. Arrows show the shift from
            base to classic-de. Filter by scenario difficulty.
          </span>
          <LiftChart dataByTier={liftDataByTier} />
        </div>

        <SideNote>
          In 0.1-preview, harness coverage is uneven across tiers: T1
          scenarios were only run with base-rt, T3 only with classic-de.
          Only T2 and the pooled view have both harnesses represented,
          and even there base-rt sample sizes are small (1{"\u2013"}2
          runs per agent). Balancing coverage is a priority for the next
          release.
        </SideNote>
      </div>

      {/* Cost and Efficiency */}
      <div className="mt-10">
        <h3 id="cost-efficiency" className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          5.3 Cost and Efficiency
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          Three distinct price bands emerge: Cursor ($0.15{"\u2013"}$0.20
          median), Claude Code ($0.32{"\u2013"}$0.45), and Codex
          ($2.71{"\u2013"}$4.42). These bands hold across every gate level.
          Within each agent, harder scenarios cost 2{"\u2013"}3{"\u00D7"} more
          (e.g. Claude Code: $0.24 at T1 vs $0.58 at T3; Codex: $2.57 vs
          $8.13). Time is tightly clustered: all agents take
          2.0{"\u2013"}2.8 minutes through G4 and 2.7{"\u2013"}3.4 minutes at
          G5, a spread of only 1.3{"\u00D7"}. On T3, Claude Code scores
          highest (0.98) at $0.58, while Codex scores 0.58 at $8.13.
        </p>
        <div className="mt-4 border-l-2 border-[color:var(--accent)] pl-4">
          <p className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[1.2px] text-[color:var(--accent)]">
            Interpretation
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--accent)]">
            Spending more does not buy better results. The 18{"\u00D7"} cost
            spread between agents reflects token volume, not wall-clock effort
            or quality. Difficulty increases cost for every agent, but the
            between-agent price gap is the dominant factor. The scatter plot
            makes this visible: filtering by difficulty pushes all agents
            rightward (more expensive) and some downward (lower quality), but
            the three price-band clusters persist.
          </p>
        </div>
      </div>

      <p className="mt-4 font-[family-name:var(--font-display)] text-[11px] leading-[1.4] text-[color:var(--muted-foreground)]">
        A cheap run that fails at G1 and an expensive run that clears G5 are
        not comparable. The table shows median cost and time only for runs that
        cleared at least a given gate, so each column compares like with like.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--foreground)]">
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-left py-2 pr-4 text-[color:var(--foreground)]">
                Agent
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                All
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                G1+
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                G4+
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 text-[color:var(--foreground)]">
                G5+
              </th>
            </tr>
          </thead>
          <tbody>
            {efficiencyByGate.map((row) => {
              const all = row.gates[0]!;
              const g1 = row.gates[1]!;
              const g4 = row.gates[4]!;
              const g5 = row.gates[5]!;
              return (
                <Fragment key={row.agent}>
                  <tr className="">
                    <td className="pt-2.5 pb-0 pr-4 text-xs font-bold" rowSpan={2}>
                      {AGENT_LABELS[row.agent] ?? row.agent}
                    </td>
                    <td className="pt-2.5 pb-0 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                      {formatCost(all.medianCost)} <span className="text-[10px] text-[color:var(--chart-4)]">n={all.n}</span>
                    </td>
                    <td className="pt-2.5 pb-0 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                      {formatCost(g1.medianCost)} <span className="text-[10px] text-[color:var(--chart-4)]">n={g1.n}</span>
                    </td>
                    <td className="pt-2.5 pb-0 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                      {formatCost(g4.medianCost)} <span className="text-[10px] text-[color:var(--chart-4)]">n={g4.n}</span>
                    </td>
                    <td className="pt-2.5 pb-0 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                      {g5.n > 0 ? <>{formatCost(g5.medianCost)} <span className="text-[10px] text-[color:var(--chart-4)]">n={g5.n}</span></> : <span className="text-[10px] text-[color:var(--chart-4)]">{"\u2014"}</span>}
                    </td>
                  </tr>
                  <tr className="border-b border-[color:var(--secondary)]">
                    <td className="pt-0 pb-2.5 pr-4 text-[10px] text-right tabular-nums text-[color:var(--chart-4)]">
                      {formatTime(all.medianTime)}
                    </td>
                    <td className="pt-0 pb-2.5 pr-4 text-[10px] text-right tabular-nums text-[color:var(--chart-4)]">
                      {formatTime(g1.medianTime)}
                    </td>
                    <td className="pt-0 pb-2.5 pr-4 text-[10px] text-right tabular-nums text-[color:var(--chart-4)]">
                      {formatTime(g4.medianTime)}
                    </td>
                    <td className="pt-0 pb-2.5 text-[10px] text-right tabular-nums text-[color:var(--chart-4)]">
                      {g5.n > 0 ? formatTime(g5.medianTime) : "\u2014"}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quality vs. Cost / Time */}
      <div className="mt-8 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[1px] text-[color:var(--foreground)] block">
            Quality vs. Efficiency
          </span>
          <p className="font-[family-name:var(--font-display)] text-[11px] leading-[1.4] text-[color:var(--muted-foreground)] mt-1 mb-3">
            Each dot is one run. Score is the normalized DEC Bench score
            (0{"\u2013"}1) on a log-compressed axis. Cost is LLM API spend
            (agent-reported or derived from published pricing); time is
            wall-clock duration.
          </p>
          <CostScoreChart allData={costScoreData} agents={agents} />
        </div>
        <SideNote>
          The y-axis is log-compressed near 1.0 to visually separate runs that
          cleared G4 (score 0.91{"\u2013"}0.99) from those that cleared G5
          (score 1.0). Top-left is high quality at low cost/time.
        </SideNote>
      </div>

      <div className="mt-8">
        <Link
          href="/leaderboard"
          className="paper-btn paper-btn-primary px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold"
        >
          Explore the Leaderboard
        </Link>
      </div>
    </section>
  );
}
