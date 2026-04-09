import { SectionHeading } from "../marketing/section-heading";

const limitations = [
  {
    kicker: "6.1 SAMPLE SIZE",
    body: "Results are based on a limited number of runs per agent per scenario. Statistical significance claims require more data.",
  },
  {
    kicker: "6.2 GATE BOUNDARY SUBJECTIVITY",
    body: "The five-gate model imposes discrete quality levels. Performance within a gate is not captured by the gate label alone. The normalized score provides finer resolution.",
  },
  {
    kicker: "6.3 VERSION SENSITIVITY",
    body: "Agent capabilities change with model updates. Results reflect the model versions tested, not the agents in general.",
  },
  {
    kicker: "6.4 DOMAIN COVERAGE",
    body: "All scenarios are in the Foo Bar synthetic domain. Real-world data engineering tasks may present different challenges.",
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
