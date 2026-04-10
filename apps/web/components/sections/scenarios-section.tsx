import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";
import { SideNote } from "../marketing/side-note";
import { GateAttritionChart } from "../charts/gate-attrition-chart";
import { CostScoreChart } from "../charts/cost-score-chart";
import { LiftChart } from "../charts/lift-chart";
import { HarnessLiftChart } from "../charts/harness-lift-chart";
import {
  computeGateAttrition,
  computeCostScore,
  computeLiftData,
  computeHarnessLift,
  computePersonaLift,
  computeEfficiency,
  getAgentNames,
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
  const gateAttritionByTier = {
    all: computeGateAttrition(entries),
    "tier-1": computeGateAttrition(entries.filter((e) => scenarioTiers[e.scenario] === "tier-1")),
    "tier-2": computeGateAttrition(entries.filter((e) => scenarioTiers[e.scenario] === "tier-2")),
    "tier-3": computeGateAttrition(entries.filter((e) => scenarioTiers[e.scenario] === "tier-3")),
  };
  const costScoreData = computeCostScore(entries);
  const liftData = computeLiftData(entries, "base-rt", "classic-de");
  const harnessLiftData = computeHarnessLift(entries, "base-rt", "classic-de");
  const personaLiftData = computePersonaLift(entries);
  const efficiencyData = computeEfficiency(entries);

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
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          Task Completion
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
          <GateAttritionChart dataByTier={gateAttritionByTier} agents={agents} />
        </div>
        <SideNote>
          Computed over {numRuns} runs across {numScenarios} scenarios
          and {numAgents} agents. Both harness configurations (base-rt and
          classic-de) are combined.
        </SideNote>
      </div>

      {/* Harness Lift */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          Harness Lift
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          The lift chart compares quality against efficiency for every
          agent&times;harness pair. The question is: how much each harness
          improves the prompt variant. This captures whether domain knowledge in
          the prompt matters, and whether the tooling harness matters.
        </p>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <LiftChart data={liftData} />
        </div>

        <SideNote>
          Median normalized score and median cost/time per agent under
          base-rt and classic-de harnesses. Arrows show the shift from
          base infrastructure to the classic DE harness. Only scenarios
          attempted under both conditions are included, paired by agent.
        </SideNote>
      </div>

      {/* Cost and Efficiency */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          Cost and Efficiency
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          Raw cost is meaningful if the agent did not solve the problem. A $0.10
          run that fails at G1 and a $5.00 run that clears G5 are not
          comparable. The real question is: what does it cost to reach a given
          quality level?
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--foreground)]">
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-left py-2 pr-4 text-[color:var(--foreground)]">
                Agent
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                Median Cost
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                Median Tokens
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 text-[color:var(--foreground)]">
                Median Time
              </th>
            </tr>
          </thead>
          <tbody>
            {efficiencyData.map((row) => (
              <tr
                key={row.agent}
                className="border-b border-[color:var(--secondary)]"
              >
                <td className="py-2.5 pr-4 text-xs font-bold">
                  {AGENT_LABELS[row.agent] ?? row.agent}
                </td>
                <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {formatCost(row.medianCost)}
                </td>
                <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {formatTokens(row.medianTokens)}
                </td>
                <td className="py-2.5 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {formatTime(row.medianTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost vs. Score */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          Cost vs. Score
        </h3>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[1px] text-[color:var(--foreground)] block mb-3">
            Cost vs Score
          </span>
          <CostScoreChart allData={costScoreData} agents={agents} />
        </div>
        <SideNote>
          Each dot is one run. Score is the DEC Bench normalized score (0–1).
          Cost is LLM API spend (agent-reported or derived from published
          pricing). Only runs that cleared the selected gate threshold are
          shown. X axis is log-scaled; top-left is high quality at low cost.
        </SideNote>
      </div>

      {/* Harness / Prompt Lift */}
      <div className="mt-8 space-y-0">
        <p className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--muted-foreground)]">
          Harness Lift on Cost (at selected threshold)
        </p>
        <p className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--muted-foreground)]">
          Prompt Variant Lift on Tokens (at selected threshold)
        </p>
      </div>

      <div className="mt-4 relative">
        <HarnessLiftChart harnessData={harnessLiftData} personaData={personaLiftData} />
        <SideNote>
          Median normalized score per agent under each harness condition
          (base-rt vs classic-de), paired across scenarios attempted under
          both. Delta is the percentage change from the base condition.
        </SideNote>
      </div>

      {/* Closing paragraph */}
      <div className="mt-8 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        <p>
          Specialized tooling and domain-specific prompts both improve quality
          and efficiency, but the effect is not uniform across all agents with
          varying scenarios and task types. Some agents benefit more from
          tooling; others from prompt guidance.
        </p>
      </div>

      <div className="mt-4">
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
