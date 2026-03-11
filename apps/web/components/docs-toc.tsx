"use client"

import { useRef } from "react"
import { AnchorProvider, ScrollProvider, TOCItem } from "fumadocs-core/toc"
import type { TOCItemType } from "fumadocs-core/toc"

export function TocAnchorProvider({
  toc,
  children,
}: {
  toc: TOCItemType[]
  children: React.ReactNode
}) {
  return <AnchorProvider toc={toc}>{children}</AnchorProvider>
}

export function DocsToc({ toc }: { toc: TOCItemType[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (toc.length === 0) return null

  return (
    <nav>
      <span className="text-xs font-bold uppercase tracking-[0.3em] text-black/40 block mb-3">
        ON THIS PAGE
      </span>
      <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden max-h-[calc(100vh-160px)]">
        <ScrollProvider containerRef={scrollRef}>
          <ul className="space-y-0.5">
            {toc.map((item) => (
              <li key={item.url} className="relative">
                <TOCItem
                  href={item.url}
                  className="toc-link group/toc relative block py-1.5 text-sm tracking-wide"
                  style={{ paddingLeft: `${(item.depth - 2) * 0.5 + 1}rem` }}
                >
                  <span className="toc-indicator" />
                  <span className="toc-label">{item.title}</span>
                </TOCItem>
              </li>
            ))}
          </ul>
        </ScrollProvider>
      </div>
    </nav>
  )
}
