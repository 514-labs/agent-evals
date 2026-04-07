import Link from "next/link";
import { AnimatedLogo } from "./animated-logo";

interface NavProps {
  showLeaderboard?: boolean;
  activeItem?: "docs" | "leaderboard" | "audit";
  sticky?: boolean;
  fullWidth?: boolean;
  variant?: "default" | "paper";
}

const sectionAnchors = [
  { href: "#evaluation-design", label: "Methodology" },
  { href: "#results", label: "Results" },
  { href: "#scenarios", label: "Scenarios" },
  { href: "#harnesses", label: "Harnesses" },
];

export function Nav({
  activeItem,
  sticky = false,
  fullWidth = false,
  variant = "default",
}: NavProps) {
  const isLanding = variant === "paper";
  const isSticky = sticky || isLanding;

  const linkClass = (active?: boolean) =>
    `text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 transition-colors font-[family-name:var(--font-mono)] ${
      active
        ? "bg-[#1C1917] text-[#F9F7F3]"
        : "text-[#57534E] hover:text-[#1C1917]"
    }`;

  return (
    <nav
      className={`relative z-20 border-b border-[#D6D3D1] bg-[#F9F7F3]/95 backdrop-blur-sm ${
        isSticky ? "sticky top-0 z-50" : ""
      }`}
    >
      <div
        className={`py-3 flex items-center justify-between gap-4 ${
          fullWidth
            ? "px-4"
            : isLanding
              ? "max-w-[52rem] mx-auto px-6"
              : "max-w-6xl mx-auto px-6 lg:px-12"
        }`}
      >
        <Link href="/" className="shrink-0">
          {isLanding ? (
            <span className="font-[family-name:var(--font-display)] text-base tracking-tight font-semibold">
              DEC
            </span>
          ) : (
            <AnimatedLogo />
          )}
        </Link>

        <div className="flex items-center gap-1 md:gap-3 flex-wrap justify-end">
          {isLanding ? (
            <>
              {sectionAnchors.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="hidden md:inline text-[10px] font-bold uppercase tracking-[0.12em] text-[#57534E] hover:text-[#1C1917] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
                >
                  {link.label}
                </a>
              ))}
              {/* Hidden for Apr 9 launch - re-enable after docs review
              <span className="hidden lg:inline text-[#D6D3D1]">·</span>
              <Link
                href="/docs"
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#57534E] hover:text-[#1C1917] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
              >
                Docs
              </Link>
              */}
              <a
                href="https://github.com/514-labs/agent-evals"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#57534E] hover:text-[#1C1917] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
              >
                GitHub
              </a>
              <span className="text-[9px] uppercase tracking-[0.15em] text-[#A8A29E] border border-[#D6D3D1] px-2 py-0.5 font-[family-name:var(--font-mono)]">
                v0.1
              </span>
            </>
          ) : (
            <>
              {/* Hidden for Apr 9 launch - re-enable after docs review
              <Link href="/docs" className={linkClass(activeItem === "docs")}>
                Docs
              </Link>
              */}
              <Link
                href="/leaderboard"
                className={linkClass(activeItem === "leaderboard")}
              >
                Leaderboard
              </Link>
              <Link
                href="/audit"
                className={linkClass(activeItem === "audit")}
              >
                Audit
              </Link>
              <a
                href="https://github.com/514-labs/agent-evals"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#57534E] border border-[#D6D3D1] px-2.5 py-1 hover:bg-[#1C1917] hover:text-[#F9F7F3] hover:border-[#1C1917] transition-all font-[family-name:var(--font-mono)]"
              >
                GH ↗
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
