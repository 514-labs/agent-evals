"use client";

import { useState } from "react";
import Link from "next/link";

interface MobileMenuProps {
  links: { href: string; label: string }[];
}

export function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex flex-col gap-[4px] p-1.5"
        aria-label="Toggle menu"
      >
        <span
          className={`block w-[16px] h-[1.5px] bg-[color:var(--foreground)] transition-transform ${
            open ? "rotate-45 translate-y-[5.5px]" : ""
          }`}
        />
        <span
          className={`block w-[16px] h-[1.5px] bg-[color:var(--foreground)] transition-opacity ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block w-[16px] h-[1.5px] bg-[color:var(--foreground)] transition-transform ${
            open ? "-rotate-45 -translate-y-[5.5px]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 border-b border-[color:var(--sidebar)] bg-[color:var(--card)] z-50">
          <div className="max-w-[1070px] mx-auto px-6 py-4 flex flex-col gap-3">
            {links.map((link) =>
              link.href.startsWith("#") || link.href.startsWith("http") ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors py-1"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors py-1"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
