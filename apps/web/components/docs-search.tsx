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
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search docs"
        aria-label="Search documentation"
      />

      {query.error ? (
        <p className="text-xs text-destructive">Search index is unavailable.</p>
      ) : null}

      {query.data && query.data !== "empty" ? (
        <ul className="space-y-1 rounded-lg border p-2">
          {query.data.slice(0, 8).map((result) => (
            <li key={result.id}>
              <Link href={result.url} className="block rounded-md p-2 text-sm hover:bg-muted">
                <p className="line-clamp-1">{result.content}</p>
                {result.breadcrumbs && result.breadcrumbs.length > 0 ? (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {result.breadcrumbs.join(" / ")}
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
