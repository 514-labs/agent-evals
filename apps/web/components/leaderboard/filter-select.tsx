"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";

type FilterSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function FilterSelect({
  label,
  value,
  options,
  onValueChange,
  className,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "bg-card border-secondary rounded-none h-8 gap-1.5 px-4 py-2",
          "font-[family-name:var(--font-display)] text-[11px] font-bold text-muted-foreground",
          "hover:border-foreground/30 transition-colors cursor-pointer",
          className,
        )}
      >
        <SelectValue placeholder={`${label} ALL`} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="rounded-none border-secondary bg-card"
      >
        <SelectItem
          value="__all__"
          className="rounded-none font-[family-name:var(--font-display)] text-[11px] font-bold text-muted-foreground"
        >
          {label} ALL
        </SelectItem>
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="rounded-none font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
