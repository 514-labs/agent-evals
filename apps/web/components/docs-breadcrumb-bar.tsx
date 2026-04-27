"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Root } from "fumadocs-core/page-tree"

import { getBreadcrumbFromTree } from "@/lib/docs-navigation"

export function DocsBreadcrumbBar({ tree }: { tree: Root }) {
  const pathname = usePathname()
  const crumbs = getBreadcrumbFromTree(tree, pathname)

  if (crumbs.length === 0) return null

  return (
    <div className="border-b border-[color:var(--border)] bg-[color:var(--sidebar)]/60">
      <div className="mx-auto max-w-[1420px] px-6 lg:px-14 h-[34px] flex items-center gap-[7px] overflow-x-auto">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1
          return (
            <span
              key={`${idx}-${crumb.label}`}
              className="flex items-center gap-[7px] shrink-0"
            >
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-[family-name:var(--font-mono)] text-[9px] font-normal uppercase tracking-[0.08em] text-[color:var(--chart-4)] hover:text-[color:var(--foreground)] transition-colors whitespace-nowrap"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={`font-[family-name:var(--font-mono)] text-[9px] font-normal uppercase tracking-[0.08em] whitespace-nowrap ${
                    isLast
                      ? "text-[color:var(--muted-foreground)]"
                      : "text-[color:var(--chart-4)]"
                  }`}
                >
                  {crumb.label}
                </span>
              )}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--chart-4)] leading-none"
                >
                  ›
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}
