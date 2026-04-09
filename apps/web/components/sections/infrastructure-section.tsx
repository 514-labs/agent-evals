import { SectionHeading } from "../marketing/section-heading";

const infrastructure = [
  {
    name: "POSTGRES",
    logo: "/logos/postgres.svg",
    description: "Transactional source of truth. Schema migrations, foreign keys, constraints.",
  },
  {
    name: "CLICKHOUSE",
    logo: "/logos/clickhouse.svg",
    description: "Columnar analytics engine. Materialized views, partition keys, ORDER BY optimization.",
  },
  {
    name: "REDPANDA",
    logo: "/logos/redpanda.svg",
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
              <div className="size-6 flex items-center justify-center bg-white/95 border border-white rounded-sm overflow-hidden">
                <img
                  src={item.logo}
                  alt={item.name}
                  width={18}
                  height={18}
                  className="object-contain"
                />
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
