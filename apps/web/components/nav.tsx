import Link from "next/link";
import { AnimatedLogo } from "./animated-logo";
import { MobileMenu } from "./mobile-menu";

interface NavProps {
  showLeaderboard?: boolean;
  activeItem?: "docs" | "leaderboard" | "audit";
  sticky?: boolean;
  fullWidth?: boolean;
  variant?: "default" | "paper";
}

const sectionAnchors = [
  { href: "#scenarios", label: "Scenarios", disabled: true },
  { href: "/leaderboard", label: "Leaderboard", external: false, disabled: true },
  { href: "#results", label: "Compare", disabled: true },
] as const;

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
        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
    }`;

  return (
    <nav
      className={`relative z-20 border-b border-[color:var(--secondary)] bg-[color:var(--card)]/95 backdrop-blur-sm ${
        isSticky ? "sticky top-0 z-50" : ""
      }`}
    >
      <div
        className={`py-3 flex items-center justify-between gap-4 ${
          fullWidth
            ? "px-4"
            : isLanding
              ? "max-w-[1070px] mx-auto px-6"
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
              {sectionAnchors.map((link) =>
                link.disabled ? (
                  <span
                    key={link.href}
                    className="hidden lg:inline text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--border)] px-1.5 py-1 font-[family-name:var(--font-mono)] cursor-default"
                  >
                    {link.label}
                  </span>
                ) : link.href.startsWith("#") ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className="hidden lg:inline text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hidden lg:inline text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
                  >
                    {link.label}
                  </Link>
                ),
              )}
              <a
                href="https://github.com/514-labs/agent-evals"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors px-1.5 py-1 font-[family-name:var(--font-mono)]"
              >
                GitHub
              </a>
              <span className="text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--accent)] border border-[color:var(--secondary)] px-2 py-0.5 font-[family-name:var(--font-mono)]">
                V0.1
              </span>
              <MobileMenu
                links={[
                  ...sectionAnchors.filter((l) => !l.disabled),
                  { href: "https://github.com/514-labs/agent-evals", label: "GitHub" },
                ]}
              />
            </>
          ) : (
            <>
              {/* Hidden for Apr 9 launch - re-enable after docs review
              <Link href="/docs" className={linkClass(activeItem === "docs")}>
                Docs
              </Link>
              */}
              {/* Re-enable after next release
              <Link
                href="/leaderboard"
                className={linkClass(activeItem === "leaderboard")}
              >
                Leaderboard
              </Link>
              */}
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
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] border border-[color:var(--border)] px-2.5 py-1 hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)] hover:border-[color:var(--foreground)] transition-all font-[family-name:var(--font-mono)]"
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
