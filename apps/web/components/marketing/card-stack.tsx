import type { ReactNode } from "react";

interface CardStackItem {
  number: string;
  title: string;
  body: ReactNode;
}

interface CardStackProps {
  items: CardStackItem[];
}

export function CardStack({ items }: CardStackProps) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div
          key={item.number}
          className={`flex flex-col gap-1.5 p-5 overflow-clip ${
            i === 0
              ? "border border-[color:var(--border)]"
              : "border-x border-b border-[color:var(--border)]"
          }`}
        >
          <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--accent)]">
            {item.number}.
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-[29px] text-[color:var(--foreground)]">
            {item.title}:
          </h3>
          <p className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}
