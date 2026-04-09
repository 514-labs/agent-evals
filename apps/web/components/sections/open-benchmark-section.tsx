import { SectionHeading } from "../marketing/section-heading";

export function OpenBenchmarkSection() {
  return (
    <section id="open-benchmark" className="pt-10">
      <SectionHeading number={7} title="Open Benchmark" />

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        DEC Bench is open source and fully containerized. Run the evaluation on
        your own agents, contribute new scenarios, or extend the methodology.
      </p>
    </section>
  );
}
