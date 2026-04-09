interface TocEntry {
  id: string;
  number: number;
  label: string;
}

interface TocGridProps {
  entries: TocEntry[];
}

export function TocGrid({ entries }: TocGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2">
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          className="flex items-center gap-3 h-6 overflow-clip group hover:text-[color:var(--accent)] transition-colors"
        >
          <span className="font-[family-name:var(--font-display)] text-xl font-bold text-[color:var(--muted-foreground)] shrink-0 group-hover:text-[color:var(--accent)]">
            &sect;{entry.number}
          </span>
          <span className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] shrink-0 group-hover:text-[color:var(--accent)]">
            {entry.label}
          </span>
          <span className="flex-1 border-b border-dashed border-[color:var(--border)] translate-y-[-2px]" />
        </a>
      ))}
    </div>
  );
}
