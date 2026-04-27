import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getScenarioAuditIndex,
  getScenarioAuditContext,
  listAuditScenarios,
} from "@/data/audits";

function formatScenarioName(value: string): string {
  const words = value.replace(/^foo-bar-/, "").split("-");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function generateStaticParams() {
  return listAuditScenarios().map((scenario) => ({ scenario }));
}

export default async function ScenarioAuditLandingPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario } = await params;
  const index = getScenarioAuditIndex(scenario);
  const context = getScenarioAuditContext(scenario);

  if (!index && !context) {
    notFound();
  }

  const latestRun = index?.runs[0];
  if (latestRun) {
    redirect(`/audit/${scenario}/${latestRun.runId}`);
  }

  return (
    <div className="mx-auto max-w-[1420px] px-6 lg:px-14 py-10">
      <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)] mb-4">
        <Link
          href="/audit"
          className="hover:text-[color:var(--foreground)] transition-colors"
        >
          Audit
        </Link>
        <span>›</span>
        <span className="text-[color:var(--muted-foreground)]">
          {formatScenarioName(scenario)}
        </span>
      </div>

      <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
        <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-5 py-2.5">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            No Runs Available
          </span>
        </div>
        <div className="p-6">
          <h1 className="font-[family-name:var(--font-display)] tracking-tight text-3xl text-[color:var(--foreground)]">
            {context?.title ?? formatScenarioName(scenario)}
          </h1>
          <p className="mt-3 text-sm text-[color:var(--muted-foreground)] max-w-2xl leading-relaxed">
            No run bundles have been exported for this scenario yet. Run{" "}
            <code className="font-mono text-[color:var(--foreground)] bg-[color:var(--secondary)] border border-[color:var(--border)] px-1.5 py-0.5 text-xs">
              pnpm export:audits
            </code>{" "}
            to generate audit bundles from result files.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/audit"
              className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--foreground)] text-[color:var(--foreground)] hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)] transition-colors"
            >
              All Scenarios
            </Link>
            <Link
              href="/leaderboard"
              className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)] hover:border-[color:var(--foreground)] transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
