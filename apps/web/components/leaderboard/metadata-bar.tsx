"use client";

import { Button } from "@workspace/ui/components/button";

type MetadataBarProps = {
  label: string;
  onDownloadCsv?: () => void;
};

export function MetadataBar({ label, onDownloadCsv }: MetadataBarProps) {
  return (
    <div className="border-t border-border flex items-center justify-between pt-px h-[38px]">
      <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium text-muted-foreground tracking-[1.4px] uppercase">
        {label}
      </span>
      {onDownloadCsv && (
        <Button
          variant="outline"
          size="xs"
          onClick={onDownloadCsv}
          className="rounded-none border-border font-[family-name:var(--font-mono)] text-[9px] font-bold text-muted-foreground tracking-[0.9px] uppercase"
        >
          Download CSV ↓
        </Button>
      )}
    </div>
  );
}
