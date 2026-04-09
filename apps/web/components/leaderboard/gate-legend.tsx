const GATE_NAMES = [
  { id: "G1", name: "Functional" },
  { id: "G2", name: "Correct" },
  { id: "G3", name: "Robust" },
  { id: "G4", name: "Performant" },
  { id: "G5", name: "Production" },
];

export function GateLegend() {
  return (
    <div className="border-b border-border flex items-center justify-between py-2">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 bg-muted-foreground" />
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-light text-muted-foreground">
            All 5 gates &mdash; perfect score
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 border border-accent" />
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-light text-muted-foreground">
            Gate not reached
          </span>
        </div>
      </div>

      <div className="flex items-center">
        {GATE_NAMES.map((gate, i) => (
          <div
            key={gate.id}
            className={`font-[family-name:var(--font-mono)] text-[9px] font-light text-muted-foreground px-2 ${
              i > 0 ? "border-l border-border" : ""
            }`}
          >
            {gate.id} {gate.name}
          </div>
        ))}
      </div>
    </div>
  );
}
