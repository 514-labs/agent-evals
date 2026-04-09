type Step = {
  number: string;
  title: string;
  description: string;
};

const DEFAULT_STEPS: Step[] = [
  {
    number: "01",
    title: "Run via CLI",
    description:
      "Execute any scenario using the dec-bench CLI. All runs are containerised and deterministic.",
  },
  {
    number: "02",
    title: "Results captured",
    description:
      "Gate results, scores, timing, and cost are recorded automatically with a unique run ID.",
  },
  {
    number: "03",
    title: "Independent verification",
    description:
      "DEC Labs re-runs a random sample of submitted results to verify reproducibility before publication.",
  },
  {
    number: "04",
    title: "Published with run ID",
    description:
      "Verified runs are published with their run ID, enabling full audit via dec-bench audit.",
  },
];

type StepsRowProps = {
  steps?: Step[];
};

export function StepsRow({ steps = DEFAULT_STEPS }: StepsRowProps) {
  return (
    <div className="border-t border-border flex items-start py-6">
      {steps.map((step, i) => (
        <div
          key={step.number}
          className={`flex flex-col gap-1.5 flex-1 pr-5 ${
            i > 0 ? "border-l border-border pl-5" : ""
          }`}
        >
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold text-muted-foreground tracking-[1.08px] uppercase">
            Step {step.number}
          </span>
          <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-muted-foreground">
            {step.title}
          </span>
          <p className="font-[family-name:var(--font-mono)] text-[11px] font-light text-muted-foreground leading-[17.6px]">
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}
