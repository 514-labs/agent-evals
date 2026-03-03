"use client"

import Link from "next/link"
import { useMemo } from "react"

import { Input } from "@workspace/ui/components/input"
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
    <div>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search docs..."
        aria-label="Search documentation"
        className="h-8 border border-black/15 bg-white text-xs font-[family-name:var(--font-body)] tracking-wide placeholder:text-black/30 focus-visible:border-[#FF10F0] focus-visible:ring-[#FF10F0]/20"
      />

      {query.error ? (
        <p className="mt-2 text-xs text-red-600">Search index is unavailable.</p>
      ) : null}

      {query.data && query.data !== "empty" ? (
        <ul className="mt-2 border border-black/15 bg-white">
          {query.data.slice(0, 8).map((result) => (
            <li key={result.id} className="border-b last:border-b-0 border-black/10">
              <Link href={result.url} className="block px-3 py-1.5 text-xs text-black/70 hover:text-black hover:bg-black/[0.03] transition-colors">
                <p className="line-clamp-1">{result.content}</p>
                {result.breadcrumbs && result.breadcrumbs.length > 0 ? (
                  <p className="line-clamp-1 text-xs text-black/30 mt-0.5">
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
