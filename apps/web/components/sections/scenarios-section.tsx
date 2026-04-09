import { SectionHeading } from "../marketing/section-heading";
import { SideNote } from "../marketing/side-note";

const gateThresholds = ["G1", "G2", "G3", "G4", "G5"];

const efficiencyRows = [
  { agent: "Claude Code", medianCost: "\u2014", medianTokens: "\u2014", medianTime: "\u2014" },
  { agent: "Codex", medianCost: "\u2014", medianTokens: "\u2014", medianTime: "\u2014" },
  { agent: "Cursor", medianCost: "\u2014", medianTokens: "\u2014", medianTime: "\u2014" },
];

export function ScenariosSection() {
  return (
    <section id="comparative-results" className="pt-10">
      <SectionHeading number={4} title="Comparative Results" />

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        This section presents the benchmark results in three parts. First, how
        agents perform across the five quality gates. Then, how quality trades
        off against cost and time. Finally, scenario-level detail.
      </p>

      {/* The Quality Story */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          The Quality Story
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          A run tells you which agent-harness pair clears which quality gates,
          and where it falls off. The gate-attrition curve is the primary
          quality visualization. The question is: how much domain knowledge the
          prompt provides, and whether the tooling harness matters.
        </p>
      </div>

      <div className="mt-4 relative">
        <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[color:var(--foreground)]">
          Gate Attrition by Agent
        </span>
        <div className="mt-2 border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            FIG. 1 &mdash; Gate attrition per agent &times; harness
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Chart visualization renders with evaluation data
            </span>
          </p>
        </div>
        <SideNote>
          This run scores 0.95. Three of four agents cluster between 0.95 and
          0.99. One agent scored 0.10, suggesting a binary outcome on this
          scenario: agents either solve the connection problem or fail entirely.
          The shape of this distribution changes per scenario.
        </SideNote>
      </div>

      {/* The Lift Story */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          The Lift Story
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          The lift chart compares quality against efficiency for every
          agent&times;harness pair. The question is: how much each harness
          improves the prompt variant. This captures whether domain knowledge in
          the prompt matters, and whether the tooling harness matters.
        </p>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] p-6 flex items-center justify-center min-h-[360px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            FIG. 2 &mdash; Gated score vs. efficiency per agent &times; harness
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Chart visualization renders with evaluation data
            </span>
          </p>
        </div>
        <SideNote>
          Lift is the median score delta between the two conditions (e.g. base
          infrastructure median to classic DE median) across all scenarios
          attempted by that agent on both variants. Only scenarios with runs on
          both conditions are included to avoid confounding by scenario
          difficulty.
        </SideNote>
      </div>

      {/* The Efficiency Story */}
      <div className="mt-10">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
          The Efficiency Story
        </h3>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          Raw cost is meaningful if the agent did not solve the problem. A $0.10
          run that fails at G1 and a $5.00 run that clears G5 are not
          comparable. The real question is: what does it cost to reach a given
          quality level?
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          The table below shows the median cost, tokens, and time for each
          agent, filtered to runs that cleared the selected gate. At G1
          (Robust), you can see costs for production-quality results. The story
          changes at each gate.
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
            {efficiencyRows.map((row) => (
              <tr
                key={row.agent}
                className="border-b border-[color:var(--secondary)]"
              >
                <td className="py-2.5 pr-4 text-xs font-bold">
                  {row.agent}
                </td>
                <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {row.medianCost}
                </td>
                <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {row.medianTokens}
                </td>
                <td className="py-2.5 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {row.medianTime}
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

      <div className="mt-4 flex items-center gap-3">
        <span className="font-[family-name:var(--font-display)] text-sm text-[color:var(--muted-foreground)]">
          Gate threshold selector:
        </span>
        <div className="flex gap-1.5">
          {gateThresholds.map((g) => (
            <span
              key={g}
              className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] border border-[color:var(--secondary)] bg-[color:var(--card)] px-3 py-1"
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            FIG. 3 &mdash; Cost vs. score scatter plot
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Chart visualization renders with evaluation data
            </span>
          </p>
        </div>
        <SideNote>
          Each dot is one benchmark run that cleared the selected gate
          threshold. Cost is LLM API spend (agent-reported or derived from
          published pricing). X axis uses log scale. The top-left region
          represents high quality at low cost.
        </SideNote>
      </div>

      <p className="mt-4 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        Each dot is one run at the selected gate threshold. Cost is LLM API
        cost in USD. Score is the normalized score. The top-left region
        represents high quality at low cost.
      </p>

      {/* Harness / Prompt Lift */}
      <div className="mt-8 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-1">
        <p className="font-bold text-[color:var(--foreground)]">
          Harness Lift on Cost (at selected threshold)
        </p>
        <p className="font-bold text-[color:var(--foreground)]">
          Prompt Variant Lift on Tokens (at selected threshold)
        </p>
      </div>

      <div className="mt-4 relative">
        <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[200px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            FIG. 4 &mdash; Harness &amp; prompt lift charts
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Chart visualization renders with evaluation data
            </span>
          </p>
        </div>
        <SideNote>
          Same methodology as score lift, applied to cost and token metrics.
          Computed over runs at the selected gate threshold on both conditions.
          A negative delta means the lever reduced cost or tokens.
        </SideNote>
      </div>

      {/* Scenario-level detail */}
      <div className="mt-8 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        <p>
          Specialized tooling and domain-specific prompts both improve quality
          and efficiency, but the effect is not uniform across all agents with
          varying scenarios and task types. Some agents benefit more from
          tooling; others from prompt guidance.
        </p>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-0">
        <div className="border border-[color:var(--border)] p-4 min-h-[240px] flex items-center justify-center">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            Where this run sits &mdash; this scenario
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Percentile chart
            </span>
          </p>
        </div>
        <div className="border border-[color:var(--border)] border-l-0 p-4 min-h-[240px] flex items-center justify-center">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            Score vs cost &mdash; this scenario
            <br />
            <span className="font-[family-name:var(--font-display)] font-normal normal-case tracking-normal italic">
              Scatter plot
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
