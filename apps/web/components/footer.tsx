import Link from "next/link";

export function Footer({
  maxWidth = "52rem",
  marginTop = "4rem",
}: { maxWidth?: string; marginTop?: string } = {}) {
  return (
    <footer
      className="border-t-2 border-[color:var(--foreground)]"
      style={{ marginTop }}
    >
      <div className="mx-auto px-6 py-8" style={{ maxWidth }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap font-[family-name:var(--font-mono)]">
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)]">
              DEC
            </span>
            <span className="text-[color:var(--muted-foreground)]">&middot;</span>
            <Link
              href="/docs"
              className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              Documentation
            </Link>
            <span className="text-[color:var(--muted-foreground)]">&middot;</span>
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--border)] cursor-default">
              Leaderboard
            </span>
            <span className="text-[color:var(--muted-foreground)]">&middot;</span>
            <a
              href="https://github.com/514-labs/agent-evals"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="font-[family-name:var(--font-mono)]">
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)]">
              <a
                href="https://fiveonefour.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[color:var(--foreground)] transition-colors"
              >
                514 Labs
              </a>
              {" "}&middot; &copy; 2026 &middot; Open Benchmark
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
