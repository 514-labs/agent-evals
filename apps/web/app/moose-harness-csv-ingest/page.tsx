import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MooseHarnessVersionScatter } from "@/components/charts/moose-harness-version-scatter";

export const metadata: Metadata = {
  title: "Moose harness versions — CSV ingest scenario | DEC Bench",
  description:
    "Cost by version of Moose Harness on a CSV ingest scenario run: Docker-less moose dev server release notes and example interpretation.",
};

export default function MooseHarnessCsvIngestPage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] font-[family-name:var(--font-display)] overflow-x-visible">
      <Nav variant="paper" />
      <main className="max-w-[56rem] mx-auto px-6 py-12 md:py-16">
        <header className="text-center max-w-3xl mx-auto">
          <h1 className="font-[family-name:var(--font-display)] text-xl md:text-2xl font-bold leading-snug text-[color:var(--foreground)]">
            Cost by version of Moose Harness on run of CSV Ingest Scenario
          </h1>
          <p className="mt-4 font-[family-name:var(--font-display)] text-sm md:text-base text-[color:var(--muted-foreground)] leading-relaxed">
            Release of improved Docker-less moose dev server
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-7 min-w-0 overflow-visible border border-[color:var(--border)] bg-[color:var(--card)] p-5 md:p-6">
            <MooseHarnessVersionScatter />
            <p className="mt-5 max-w-prose mx-auto lg:mx-0 font-[family-name:var(--font-display)] text-[11px] md:text-xs leading-relaxed text-pretty text-[color:var(--muted-foreground)] italic text-center lg:text-left">
              <span className="font-[family-name:var(--font-mono)] not-italic font-bold text-[color:var(--foreground)]">Fig. 1</span> Scatter of
              gated score (horizontal) versus run cost in USD (vertical) by harness build, with higher cost toward the top. Red arrows trace
              V1→V5; open circles are intermediate versions, filled circle is V5. Grey point is base runtime reference.
            </p>
          </div>

          <aside className="lg:col-span-5 border-2 border-[color:var(--border)] bg-[color:var(--secondary)] p-5 md:p-6">
            <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[2px] text-[color:var(--foreground)]">
              Example
            </p>
            <div className="mt-3 space-y-2.5 font-[family-name:var(--font-display)] text-sm leading-[1.5] text-[color:var(--foreground)]">
              <p>
                Under the base runtime reference (BASE-RT), observed outcomes were gated score <span className="tabular-nums">1.0</span> and run
                cost <span className="tabular-nums">$0.45</span>. The first Docker-less harness revision (V1) yielded{" "}
                <span className="tabular-nums">0.33</span> and <span className="tabular-nums">$1.37</span>—substantially inferior on both
                metrics. The dominant mechanism was idempotency failures in the harness path, which induced systematic fallback to non-Moose
                tooling and inflated cost without increasing score.
              </p>
              <p>
                Subsequent revisions (V2–V5) reduced cost to <span className="tabular-nums">$0.48</span> and{" "}
                <span className="tabular-nums">$0.50</span> at unchanged score <span className="tabular-nums">0.33</span>, restored full
                score at <span className="tabular-nums">$0.67</span> (V4), and converged to <span className="tabular-nums">1.0</span> /{" "}
                <span className="tabular-nums">$0.43</span> (V5).
              </p>
              <p className="text-[color:var(--muted-foreground)]">
                Relative to BASE-RT, the terminal build matches reference gated score and records lower run cost (
                <span className="tabular-nums">$0.43</span> vs <span className="tabular-nums">$0.45</span>).
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
