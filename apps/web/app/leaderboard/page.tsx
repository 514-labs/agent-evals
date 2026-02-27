import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { upNext } from "../../flags";

const gateNames = [
  "—",
  "FUNCTIONAL",
  "CORRECT",
  "ROBUST",
  "PERFORMANT",
  "PRODUCTION",
];

const entries = [
  {
    rank: 1,
    agent: "CLAUDE CODE",
    model: "sonnet-4",
    harness: "classic-de",
    highestGate: 5,
    normalizedScore: 0.96,
    wallClock: 98,
    steps: 11,
    tokens: 38200,
    cost: 0.27,
  },
  {
    rank: 2,
    agent: "CLAUDE CODE",
    model: "opus-4",
    harness: "bare",
    highestGate: 5,
    normalizedScore: 0.91,
    wallClock: 142,
    steps: 18,
    tokens: 62400,
    cost: 0.89,
  },
  {
    rank: 3,
    agent: "CODEX",
    model: "gpt-4.1",
    harness: "classic-de",
    highestGate: 4,
    normalizedScore: 0.88,
    wallClock: 115,
    steps: 14,
    tokens: 44100,
    cost: 0.38,
  },
  {
    rank: 4,
    agent: "AIDER",
    model: "sonnet-4",
    harness: "classic-de",
    highestGate: 4,
    normalizedScore: 0.82,
    wallClock: 167,
    steps: 22,
    tokens: 71300,
    cost: 0.51,
  },
  {
    rank: 5,
    agent: "CODEX",
    model: "gpt-4.1",
    harness: "bare",
    highestGate: 3,
    normalizedScore: 0.74,
    wallClock: 131,
    steps: 16,
    tokens: 48200,
    cost: 0.34,
  },
  {
    rank: 6,
    agent: "CLAUDE CODE",
    model: "sonnet-4",
    harness: "bare",
    highestGate: 3,
    normalizedScore: 0.71,
    wallClock: 109,
    steps: 13,
    tokens: 41500,
    cost: 0.29,
  },
  {
    rank: 7,
    agent: "AIDER",
    model: "gpt-4.1",
    harness: "classic-de",
    highestGate: 2,
    normalizedScore: 0.63,
    wallClock: 189,
    steps: 26,
    tokens: 83100,
    cost: 0.58,
  },
  {
    rank: 8,
    agent: "CODEX",
    model: "gpt-4.1",
    harness: "olap-for-swe",
    highestGate: 2,
    normalizedScore: 0.55,
    wallClock: 154,
    steps: 19,
    tokens: 56700,
    cost: 0.42,
  },
];

function GatePips({ gate }: { gate: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((g) => (
        <div
          key={g}
          className={`w-[14px] h-[14px] border-[2px] border-black ${
            g <= gate ? "bg-[#FF10F0]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function ComingSoonState() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
        LEADER
        <br />
        BOARD
      </h1>
      <p className="mt-8 text-[12px] uppercase tracking-wider text-black/50 max-w-md mx-auto">
        Results from internal eval runs will appear here after the 0.1 release.
      </p>
      <div className="mt-8">
        <Link
          href="/docs/running-evals"
          className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
        >
          RUN AN EVAL →
        </Link>
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const showUpNext = await upNext();

  if (!showUpNext) {
    return <ComingSoonState />;
  }

  const top3 = entries.slice(0, 3);

  return (
    <div className="py-12">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
          LEADER
          <br />
          BOARD
        </h1>
        <p className="mt-4 text-[12px] uppercase tracking-wider text-black/50 max-w-md">
          Ranked by highest gate cleared, then normalized score within the gate.
          Scenario: ecommerce-pipeline.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-0 mb-16">
        {top3.map((entry, i) => (
          <div
            key={`${entry.agent}-${entry.model}-${entry.harness}`}
            className={`border-[3px] border-black p-6 ${
              i === 0
                ? "bg-[#FF10F0] md:row-start-1"
                : i === 1
                  ? "border-t-0 md:border-t-[3px] md:border-l-0 bg-black text-white"
                  : "border-t-0 md:border-t-[3px] md:border-l-0"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <span
                className={`font-[family-name:var(--font-display)] text-6xl lg:text-7xl tracking-tight ${
                  i === 0
                    ? "text-black/40"
                    : i === 1
                      ? "text-white/40"
                      : "text-black/30"
                }`}
              >
                #{entry.rank}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.2em] border-[2px] px-2 py-0.5 mt-2 ${
                  i === 1
                    ? "border-white text-white"
                    : "border-black text-black"
                }`}
              >
                {gateNames[entry.highestGate]}
              </span>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl uppercase tracking-tight leading-[0.9]">
              {entry.agent}
            </h3>
            <p
              className={`mt-1 text-[11px] uppercase tracking-wider ${
                i === 1 ? "text-white/50" : "text-black/40"
              }`}
            >
              {entry.model} · {entry.harness}
            </p>
          </div>
        ))}
      </div>

      <div className="border-[3px] border-black">
        <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
            ALL RANKINGS
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
            {entries.length} RUNS
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b-[2px] border-black/15 hover:bg-transparent">
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 w-12 pl-6">
                #
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                AGENT
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                MODEL
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                HARNESS
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                GATE
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                SCORE
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                TIME
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 pr-6">
                COST
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={`${entry.agent}-${entry.model}-${entry.harness}`}
                className={`border-b border-black/10 hover:bg-[#FF10F0]/5 transition-colors ${
                  entry.rank === 1 ? "bg-[#FF10F0]/[0.03]" : ""
                }`}
              >
                <TableCell className="pl-6">
                  <span
                    className={`font-[family-name:var(--font-display)] text-xl ${
                      entry.rank === 1 ? "text-[#FF10F0]" : "text-black/25"
                    }`}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em]">
                    {entry.agent}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] text-black/50">
                    {entry.model}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] text-black/50">
                    {entry.harness}
                  </span>
                </TableCell>
                <TableCell>
                  <GatePips gate={entry.highestGate} />
                </TableCell>
                <TableCell>
                  <span
                    className={`font-[family-name:var(--font-display)] text-2xl tracking-tight ${
                      entry.rank === 1 ? "text-[#FF10F0]" : ""
                    }`}
                  >
                    {entry.normalizedScore.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] tabular-nums text-black/50">
                    {entry.wallClock}s
                  </span>
                </TableCell>
                <TableCell className="pr-6">
                  <span className="text-[11px] tabular-nums text-black/50">
                    ${entry.cost.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-black/50">
            Want to see your harness or agent here?
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/docs"
            className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
          >
            GET STARTED →
          </Link>
        </div>
      </div>
    </div>
  );
}
