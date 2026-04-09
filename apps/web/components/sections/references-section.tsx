const references = [
  "[1] Ardent AI Labs. DE-Bench: A Benchmark for Data Engineering Tasks. 2025.",
  "[2] dbt Labs. skill-eval: Evaluating LLM competency on dbt tasks. 2025.",
  "[3] Jimenez, C.E., et al. SWE-bench: Can Language Models Resolve Real-World GitHub Issues? 2024.",
];

export function ReferencesSection() {
  return (
    <section id="references" className="pt-12 pb-8">
      <div className="border-t border-[color:var(--border)] pt-8 flex flex-col gap-2">
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          References
        </span>
        <div className="h-2 border-b border-[color:var(--border)]" />
        {references.map((ref) => (
          <p
            key={ref}
            className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]"
          >
            {ref}
          </p>
        ))}
      </div>
    </section>
  );
}
