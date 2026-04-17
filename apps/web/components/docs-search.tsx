"use client"

import Link from "next/link"
import { useMemo } from "react"

import { Search } from "lucide-react"
import { useDocsSearch } from "fumadocs-core/search/client"

export function DocsSearch() {
  const clientOptions = useMemo(
    () => ({
      type: "static" as const,
      from: "/api/search",
    }),
    []
  )

  const { search, setSearch, query } = useDocsSearch(clientOptions)

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[color:var(--secondary)] border border-[color:var(--border)] rounded-[3px] px-2.5 py-1.5">
        <Search
          aria-hidden="true"
          strokeWidth={2}
          className="w-4 h-4 shrink-0 text-[color:var(--chart-4)]"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search docs..."
          aria-label="Search documentation"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] leading-[26px] text-[color:var(--foreground)] placeholder:text-[color:var(--chart-4)] font-[family-name:var(--font-display)]"
        />
      </div>

      {query.error ? (
        <p className="mt-2 text-xs text-[color:var(--accent)]">
          Search index is unavailable.
        </p>
      ) : null}

      {query.data && query.data !== "empty" ? (
        <ul className="absolute left-0 right-0 z-30 mt-1 border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
          {query.data.slice(0, 8).map((result) => (
            <li
              key={result.id}
              className="border-b last:border-b-0 border-[color:var(--border)]"
            >
              <Link
                href={result.url}
                className="block px-3 py-1.5 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] transition-colors"
              >
                <p className="line-clamp-1">{result.content}</p>
                {result.breadcrumbs && result.breadcrumbs.length > 0 ? (
                  <p className="line-clamp-1 text-[11px] text-[color:var(--chart-4)] mt-0.5 font-[family-name:var(--font-mono)]">
                    {result.breadcrumbs.join(" → ")}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
