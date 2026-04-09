import { SectionHeading } from "../marketing/section-heading";

const infrastructure = [
  {
    name: "POSTGRES",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
      </svg>
    ),
    description: "Transactional source of truth. Schema migrations, foreign keys, constraints.",
  },
  {
    name: "CLICKHOUSE",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <rect x="2" y="2" width="4" height="20" rx="0.5" fill="currentColor"/>
        <rect x="7" y="6" width="4" height="16" rx="0.5" fill="currentColor"/>
        <rect x="12" y="2" width="4" height="20" rx="0.5" fill="currentColor"/>
        <rect x="17" y="6" width="4" height="16" rx="0.5" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
    description: "Columnar analytics engine. Materialized views, partition keys, ORDER BY optimization.",
  },
  {
    name: "REDPANDA",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    description: "Kafka-compatible event streaming. Topics, consumers, partitions.",
  },
];

export function InfrastructureSection() {
  return (
    <section id="infrastructure" className="pt-10">
      <SectionHeading number={5} title="Infrastructure" />

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        All scenarios run against real databases, fully containerized.
      </p>

      <div className="mt-6 border-b border-[color:var(--secondary)]">
        <div className="flex border-b border-[color:var(--secondary)]">
          {infrastructure.map((item) => (
            <div
              key={item.name}
              className="flex-1 flex items-center gap-2.5 px-4 py-3"
            >
              <div className="size-6 flex items-center justify-center bg-white/95 border border-white rounded-sm text-[color:var(--foreground)]">
                {item.icon}
              </div>
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)]">
                {item.name}
              </span>
            </div>
          ))}
        </div>
        <div className="flex">
          {infrastructure.map((item) => (
            <div
              key={item.name}
              className="flex-1 px-4 py-3"
            >
              <p className="font-[family-name:var(--font-display)] text-xs leading-normal text-[color:var(--muted-foreground)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
