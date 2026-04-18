import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { HarnessScenarioMatrixCharts } from "@/components/charts/harness-scenario-matrix-charts";

export const metadata: Metadata = {
  title: "Harness versions × scenarios — score vs cost & score vs time | DEC Bench",
  description:
    "Per-scenario scatter plots: gated score vs run cost and gated score vs wall time across Moose Docker-less harness revisions (baseline, v2–v5).",
};

export default function HarnessVersionScenarioMatrixPage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] font-[family-name:var(--font-display)] overflow-x-visible">
      <Nav variant="paper" />
      <main className="max-w-[min(100%,96rem)] mx-auto px-4 sm:px-6 py-10 md:py-14">
        <header className="max-w-3xl mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-xl md:text-2xl font-bold leading-snug">
            Harness version × scenario matrix
          </h1>
          <p className="mt-3 font-[family-name:var(--font-display)] text-sm text-[color:var(--muted-foreground)] leading-relaxed">
            Each row is one scenario (label on the left). Use the <span className="font-[family-name:var(--font-mono)]">Score vs. Cost / Time</span>{" "}
            control (same control pattern as the comparative results section on the paper homepage) to switch the horizontal axis between{" "}
            <span className="font-[family-name:var(--font-mono)]">cost (USD)</span> and <span className="font-[family-name:var(--font-mono)]">time (s)</span>
            ; <span className="font-[family-name:var(--font-mono)]">gated score</span> is always on the vertical axis. Points are harness personas
            (baseline, v2–v5); missing revisions have no point.
          </p>
        </header>

        <HarnessScenarioMatrixCharts />
      </main>
      <Footer />
    </div>
  );
}
