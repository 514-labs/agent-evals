import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getScenarioAuditIndex,
  getScenarioAuditContext,
  listAuditScenarios,
} from "@/data/audits";

function formatScenarioName(value: string): string {
  return value
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
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
    <div className="px-4 lg:px-8 py-8">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-black/40 mb-4">
        <Link href="/audit" className="hover:text-black transition-colors">
          Audit
        </Link>
        <span>/</span>
        <span className="text-black/70">
          {formatScenarioName(scenario)}
        </span>
      </div>

      <div className="border-[3px] border-black">
        <div className="bg-black px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
            No Runs Available
          </span>
        </div>
        <div className="p-6">
          <h1 className="font-[family-name:var(--font-display)] uppercase tracking-tight text-4xl">
            {context?.title ?? formatScenarioName(scenario)}
          </h1>
          <p className="mt-3 text-[12px] text-black/50 max-w-2xl leading-relaxed">
            No run bundles have been exported for this scenario yet. Run{" "}
            <code className="text-black/70 bg-black/5 px-1.5 py-0.5 text-[11px]">
              pnpm export:audits
            </code>{" "}
            to generate audit bundles from result files.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/audit"
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-4 py-2 border-[2px] border-black hover:bg-[#FF10F0] transition-colors"
            >
              All Scenarios
            </Link>
            <Link
              href="/leaderboard"
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-4 py-2 border-[2px] border-black hover:bg-black hover:text-white transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
