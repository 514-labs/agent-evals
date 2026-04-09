"use client";

import { useEffect, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";

interface TocItem {
  id: string;
  label: string;
}

const TOC_ITEMS: TocItem[] = [
  { id: "score", label: "Score" },
  { id: "comparison", label: "Comparison" },
  { id: "result", label: "Result" },
  { id: "assertions", label: "Assertions" },
  { id: "gate-progression", label: "Gate Progression" },
  { id: "run-metrics", label: "Run Metrics" },
  { id: "agent-trajectory", label: "Agent Trajectory" },
  { id: "scenario", label: "Scenario" },
  { id: "prompt", label: "Prompt" },
  { id: "debugging", label: "Debugging Output" },
];

export function SidebarToc() {
  const [activeId, setActiveId] = useState<string>("score");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const item of TOC_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="border-l-2 border-background">
      {TOC_ITEMS.map((item) => {
        const isActive = activeId === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              "relative block py-[4px] pl-[6px] font-[family-name:var(--font-mono)] text-[9px] tracking-[0.54px] transition-colors",
              isActive
                ? "text-foreground border-l-2 border-foreground -ml-[2px]"
                : "text-border hover:text-muted-foreground",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
