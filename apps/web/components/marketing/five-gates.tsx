interface Gate {
  number: string;
  name: string;
  description: string;
}

const defaultGates: Gate[] = [
  { number: "01", name: "FUNCTIONAL", description: "The code runs without errors" },
  { number: "02", name: "CORRECT", description: "It produces expected output" },
  { number: "03", name: "ROBUST", description: "It handles edge cases and error conditions" },
  { number: "04", name: "PERFORMANT", description: "It meets latency and throughput targets" },
  { number: "05", name: "PRODUCTION", description: "Code quality, documentation, and operational readiness are fit for release" },
];

const headerColors = [
  "bg-[color:var(--foreground)] text-[color:var(--card)]",
  "bg-[color:var(--muted-foreground)] text-[color:var(--card)]",
  "bg-[color:var(--chart-4)] text-[color:var(--card)]",
  "bg-[color:var(--chart-5)] text-[color:var(--foreground)]",
  "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)]",
];

interface FiveGatesProps {
  gates?: Gate[];
}

export function FiveGates({ gates = defaultGates }: FiveGatesProps) {
  return (
    <div className="flex flex-col sm:flex-row border border-[color:var(--secondary)]">
      {gates.map((gate, i) => (
        <div
          key={gate.number}
          className={`sm:flex-1 flex flex-col ${i > 0 ? "border-t sm:border-t-0 sm:border-l border-[color:var(--secondary)]" : ""}`}
        >
          <div className={`${headerColors[i]} px-2 h-[22px] flex items-center`}>
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] leading-none">
              Gate {gate.number}
            </span>
          </div>
          <div className="px-[10px] py-[12px] flex flex-col gap-[10px]">
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">
              {gate.name}
            </span>
            <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] leading-normal">
              {gate.description}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
