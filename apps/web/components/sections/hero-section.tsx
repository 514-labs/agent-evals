import Link from "next/link";
import { MetadataRow } from "../marketing/metadata-row";

const metadata = [
  { label: "LAST UPDATED", value: "March 2026" },
  { label: "VERSION", value: "0.1-preview" },
  { label: "LICENSE", value: "MIT" },
  { label: "SCENARIOS", value: "37" },
  { label: "HARNESSES", value: "3" },
  { label: "AGENTS", value: "3" },
];

export function HeroSection() {
  return (
    <header className="max-w-[52rem] mx-auto px-6 pt-12 pb-8 flex flex-col gap-5 paper-fade-in">
      <div className="flex gap-2">
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--accent)] border border-[color:var(--accent)] bg-[color:var(--card)] px-3 py-1.5">
          Research Preview
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] border border-[color:var(--secondary)] bg-[color:var(--card)] px-3 py-1.5">
          V0.1
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] border border-[color:var(--secondary)] bg-[color:var(--card)] px-3 py-1.5">
          Open Access
        </span>
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-[44px] font-semibold leading-[51px] text-[color:var(--foreground)]">
        DEC Bench: A multi-gate evaluation framework for AI coding agents on
        data engineering tasks.
      </h1>

      <MetadataRow items={metadata} />

      <div className="flex flex-wrap gap-3 paper-fade-in-delayed">
        <Link
          href="/docs/running-evals"
          className="paper-btn paper-btn-primary px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold"
        >
          Run the evaluation
        </Link>
        <a
          href="https://github.com/514-labs/agent-evals"
          target="_blank"
          rel="noopener noreferrer"
          className="paper-btn paper-btn-ghost px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--chart-4)]"
        >
          View on Github
        </a>
        <Link
          href="/leaderboard"
          className="paper-btn paper-btn-ghost px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--chart-4)]"
        >
          View results
        </Link>
      </div>
    </header>
  );
}
