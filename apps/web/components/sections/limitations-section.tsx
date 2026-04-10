import { SectionHeading } from "../marketing/section-heading";

const limitations = [
  {
    kicker: "6.1 SAMPLE SIZE",
    body: "125 total runs across three agents, with 29\u201361 runs per agent. Tier-level breakdowns are smaller: T3 (hard) has only 2\u20136 runs per agent, limiting the confidence of difficulty-stratified findings. The statistical claims in this release (e.g. agent significance on hard scenarios) should be treated as directional.",
  },
  {
    kicker: "6.2 HARNESS AND PROMPT COVERAGE",
    body: "Only one harness pair has been tested (base-rt vs classic-de), and harness coverage is uneven (76 vs 49 runs). No prompt variant beyond the baseline has been evaluated. The finding that harness lift is not significant may change with more integrated tooling or informed prompts.",
  },
  {
    kicker: "6.3 AGENT SELECTION",
    body: "Three agents were tested: Claude Code, Codex, and Cursor. The cost\u2013quality relationship observed (spending more does not buy better results) is based on this specific set and may not generalize to other agents or pricing models.",
  },
  {
    kicker: "6.4 VERSION SENSITIVITY",
    body: "Agent capabilities change with each model update. Results reflect the specific model versions tested (e.g. Claude Opus 4.6, Sonnet 4.6) and may not hold for future releases.",
  },
  {
    kicker: "6.5 GATE BOUNDARY SUBJECTIVITY",
    body: "The five-gate model imposes discrete quality levels. Performance within a gate is not captured by the gate label alone. The normalized score provides finer resolution but still compresses scenario-specific nuance into a single number.",
  },
  {
    kicker: "6.6 DOMAIN COVERAGE",
    body: "36 of 37 scenarios use the Foo Bar synthetic domain; one uses an e-commerce domain. Real-world data engineering spans a wider range of systems, schemas, and failure modes than is currently represented.",
  },
];

export function LimitationsSection() {
  return (
    <section id="limitations" className="pt-10">
      <SectionHeading number={6} title="Limitations" />

      <div className="mt-6 flex flex-col">
        {limitations.map((item) => (
          <div
            key={item.kicker}
            className="border-b border-[color:var(--secondary)] py-2.5 flex flex-col gap-2"
          >
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
              {item.kicker}
            </span>
            <p className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
