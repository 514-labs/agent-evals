import Link from "next/link";
import {
  getLeaderboardEntries,
  getUniqueScenarios,
  getUniqueHarnesses,
  getUniqueModels,
  getUniquePersonas,
} from "../../data/results";
import { getScenarioAuditRunIds } from "../../data/audits";
import { LeaderboardClient } from "./leaderboard-client";

export const dynamic = "force-static";

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[44px] tracking-tight leading-[51px] font-semibold">
        Leaderboard
      </h1>
      <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto font-[family-name:var(--font-display)]">
        No eval results found yet. Run the research preview or help expand it
        with a new eval.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/docs/running-evals"
          className="paper-btn paper-btn-primary px-8 py-3 text-sm font-bold uppercase tracking-[0.15em] font-[family-name:var(--font-mono)]"
        >
          RUN THE PREVIEW →
        </Link>
        <Link
          href="/docs/add-eval/getting-started"
          className="paper-btn paper-btn-ghost px-8 py-3 text-sm font-bold uppercase tracking-[0.15em] font-[family-name:var(--font-mono)]"
        >
          ADD AN EVAL →
        </Link>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const allEntries = getLeaderboardEntries();

  if (allEntries.length === 0) {
    return <EmptyState />;
  }

  const scenarios = getUniqueScenarios();
  const harnesses = getUniqueHarnesses();
  const models = getUniqueModels();
  const personas = getUniquePersonas();
  const agents = [...new Set(allEntries.map((e) => e.agent))].sort();

  const auditRunIds: Record<string, string[]> = {};
  for (const s of scenarios) {
    const runIdSet = getScenarioAuditRunIds(s);
    auditRunIds[s] = [...runIdSet];
  }

  return (
    <LeaderboardClient
      allEntries={allEntries}
      scenarios={scenarios}
      harnesses={harnesses}
      models={models}
      personas={personas}
      agents={agents}
      auditRunIds={auditRunIds}
    />
  );
}
