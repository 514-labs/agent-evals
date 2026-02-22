import Link from "next/link"

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      <nav className="sticky top-0 z-50 border-b-[3px] border-black bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            DEC
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#FF10F0] px-3 py-1.5 transition-colors">DOCS</Link>
            <Link href="/leaderboard" className="text-[11px] font-bold uppercase tracking-[0.15em] bg-black text-white px-3 py-1.5">LEADERBOARD</Link>
            <a href="https://github.com/514-labs/agent-evals" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold uppercase tracking-[0.15em] border-[2px] border-black px-3 py-1 hover:bg-black hover:text-white transition-all">GH ↗</a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        {children}
      </div>

      <footer className="border-t-[3px] border-black mt-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-6 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-black/40">
          BROUGHT TO YOU BY <a href="https://fiveonefour.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-black/70 transition-colors">FIVEONEFOUR</a> · <a href="https://fiveonefour.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-black/70 transition-colors">BECOME A SPONSOR</a>
        </div>
      </footer>
    </div>
  )
}
