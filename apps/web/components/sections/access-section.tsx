import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";
import { SplitCta } from "../marketing/split-cta";

export function AccessSection() {
  return (
    <section id="evaluation-access" className="pt-10">
      <div className="border-t border-[color:var(--secondary)] pt-8">
        <SectionHeading number={8} title="Evaluation access" />

        <div className="mt-6">
          <SplitCta
            left={{
              kicker: "OPEN BENCHMARK",
              title: "Reproduce Our Results",
              body: "DEC Bench is open source and fully containerized. Clone the repository, run the evaluation suite against your preferred agent, and reproduce every result reported here.",
              actions: (
                <>
                  <Link
                    href="/docs/running-evals"
                    className="paper-btn paper-btn-primary px-4 py-1.5 font-[family-name:var(--font-display)] text-[11px] font-bold"
                  >
                    Run the evaluation
                  </Link>
                  <a
                    href="https://github.com/514-labs/agent-evals"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-btn paper-btn-ghost px-4 py-1.5 font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--chart-4)]"
                  >
                    View on Github
                  </a>
                </>
              ),
            }}
            right={{
              kicker: "RESEARCH PREVIEW",
              title: "Contribute to the Benchmark",
              body: "We invite contributions across three dimensions: running the evaluation against additional agents, developing new scenarios, and extending the methodology to adjacent domains.",
              actions: (
                <>
                  <Link
                    href="/docs/add-eval/getting-started"
                    className="paper-btn paper-btn-ghost px-4 py-1.5 font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--chart-4)] border-[color:var(--muted-foreground)]"
                  >
                    Contribute a scenario
                  </Link>
                  <Link
                    href="/docs"
                    className="paper-btn paper-btn-primary px-4 py-1.5 font-[family-name:var(--font-display)] text-[11px] font-bold"
                  >
                    Read the docs
                  </Link>
                </>
              ),
            }}
          />
        </div>
      </div>
    </section>
  );
}
