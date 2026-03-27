import Link from "next/link";
import {
  getLeaderboardEntries,
  getUniqueScenarios,
  getUniqueHarnesses,
} from "../../data/results";
import { getScenarioAuditRunIds } from "../../data/audits";
import { LeaderboardClient } from "./leaderboard-client";

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
        LEADER
        <br />
        BOARD
      </h1>
      <p className="mt-8 text-sm uppercase tracking-wider text-black/50 max-w-md mx-auto">
        No eval results found yet. Run the research preview or help expand it
        with a new eval.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/docs/running-evals"
          className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
        >
          RUN THE PREVIEW →
        </Link>
        <Link
          href="/docs/add-eval/getting-started"
          className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
        >
          ADD AN EVAL →
        </Link>
      </div>
    </div>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; agent?: string; harness?: string }>;
}) {
  const { scenario, agent, harness } = await searchParams;
  const allEntries = getLeaderboardEntries();

  if (allEntries.length === 0) {
    return <EmptyState />;
  }

  const scenarios = getUniqueScenarios();
  const harnesses = getUniqueHarnesses();
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
      agents={agents}
      auditRunIds={auditRunIds}
      initialFilters={{ scenario, agent, harness }}
    />
  );
}
