import Link from "next/link";
import { AnimatedLogo } from "./animated-logo";

interface NavProps {
  showLeaderboard?: boolean;
  activeItem?: "docs" | "leaderboard";
  sticky?: boolean;
  fullWidth?: boolean;
}

export function Nav({
  showLeaderboard = false,
  activeItem,
  sticky = false,
  fullWidth = false,
}: NavProps) {
  return (
    <nav
      className={`relative z-20 border-b-[3px] border-black bg-white ${sticky ? "sticky top-0 z-50" : ""}`}
    >
      <div
        className={`py-4 flex items-center justify-between ${fullWidth ? "px-4" : "max-w-6xl mx-auto px-6 lg:px-12"}`}
      >
        <Link href="/">
          <AnimatedLogo />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/docs"
            className={`text-[11px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 transition-colors ${
              activeItem === "docs"
                ? "bg-black text-white"
                : "hover:bg-[#FF10F0]"
            }`}
          >
            DOCS
          </Link>
          {showLeaderboard && (
            <Link
              href="/leaderboard"
              className={`text-[11px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 transition-colors ${
                activeItem === "leaderboard"
                  ? "bg-black text-white"
                  : "hover:bg-[#FF10F0]"
              }`}
            >
              LEADERBOARD
            </Link>
          )}
          <a
            href="https://github.com/514-labs/agent-evals"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold uppercase tracking-[0.15em] border-[2px] border-black px-3 py-1 hover:bg-black hover:text-white transition-all"
          >
            GH ↗
          </a>
        </div>
      </div>
    </nav>
  );
}
