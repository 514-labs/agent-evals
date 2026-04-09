import * as React from "react";
import { cn } from "@workspace/ui/lib/utils";

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
  gridCols?: string;
  className?: string;
}

export function DataTable({ columns, rows, gridCols, className }: DataTableProps) {
  const templateCols =
    gridCols ?? columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div
        className="grid border-b border-secondary h-[37px] items-center"
        style={{ gridTemplateColumns: templateCols }}
      >
        {columns.map((col) => (
          <div key={col.key} className="px-[18px] py-3">
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-foreground">
              {col.label}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid border-b border-secondary min-h-[39px] items-center"
          style={{ gridTemplateColumns: templateCols }}
        >
          {columns.map((col) => (
            <div key={col.key} className="px-[18px] py-3 min-w-0">
              <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground break-words">
                {row[col.key]}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
