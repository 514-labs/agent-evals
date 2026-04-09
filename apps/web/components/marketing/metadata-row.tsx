interface MetadataItem {
  label: string;
  value: string;
}

interface MetadataRowProps {
  items: MetadataItem[];
}

export function MetadataRow({ items }: MetadataRowProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 border border-[color:var(--border)]">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex flex-col gap-0.5 overflow-clip px-2.5 py-1 ${
            (i + 1) % 3 !== 0 || i === items.length - 1 ? "border-r border-[color:var(--border)]" : ""
          } ${i < 3 ? "border-b md:border-b-0 border-[color:var(--border)]" : ""} ${
            (i + 1) % 6 === 0 ? "border-r-0" : ""
          }`}
        >
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            {item.label}
          </span>
          <span className="font-[family-name:var(--font-display)] text-xs text-[color:var(--foreground)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
