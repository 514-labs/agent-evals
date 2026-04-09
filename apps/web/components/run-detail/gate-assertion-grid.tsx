type GateName = "functional" | "correct" | "robust" | "performant" | "production";

type GateResult = {
  passed: boolean;
  score: number;
  core: Record<string, boolean>;
  scenario: Record<string, boolean>;
};

const GATE_ORDER: GateName[] = ["functional", "correct", "robust", "performant", "production"];
const GATE_META: Record<GateName, { short: string }> = {
  functional: { short: "G1 Runtime" },
  correct: { short: "G2 Correct" },
  robust: { short: "G3 Robust" },
  performant: { short: "G4 Performant" },
  production: { short: "G5 Production" },
};

interface GateAssertionGridProps {
  gates: Record<GateName, GateResult>;
}

export function GateAssertionGrid({ gates }: GateAssertionGridProps) {
  return (
    <div className="flex border border-background">
      {GATE_ORDER.map((gate) => {
        const detail = gates[gate];
        if (!detail) return null;

        const allAssertions = [
          ...Object.entries(detail.core).map(([name, passed]) => ({ name, passed })),
          ...Object.entries(detail.scenario).map(([name, passed]) => ({ name, passed })),
        ];
        const passedCount = allAssertions.filter((a) => a.passed).length;
        const meta = GATE_META[gate];

        return (
          <div key={gate} className="flex-1 min-w-0 flex flex-col self-stretch border-l border-r border-background first:border-l-0 last:border-r-0">
            {/* Column header */}
            <div className="flex items-center gap-1 px-3 h-9 border-b border-background bg-card shrink-0">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-foreground whitespace-nowrap">
                {meta.short}
              </span>
              <span className="bg-accent/8 rounded-[2px] px-[5px] py-px font-[family-name:var(--font-mono)] text-[8px] font-bold leading-[13.6px] text-accent shrink-0">
                {passedCount}/{allAssertions.length}
              </span>
            </div>

            {/* Assertion rows */}
            <div className="flex-1 pb-2">
              {allAssertions.map((assertion) => (
                <div
                  key={`${gate}-${assertion.name}`}
                  className={`px-2.5 py-1 border-b border-background last:border-b-0 ${
                    !assertion.passed ? "bg-secondary" : ""
                  }`}
                >
                  <span
                    className={`font-[family-name:var(--font-display)] text-[10px] leading-normal break-words ${
                      assertion.passed ? "text-muted-foreground" : "text-accent"
                    }`}
                  >
                    {assertion.passed ? "■" : "□"}&nbsp;{assertion.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
