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
      <p className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[28px] text-[color:var(--muted-foreground)] mb-3">
        On this page
      </p>
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden max-h-[calc(100vh-160px)] pl-1"
      >
        <ScrollProvider containerRef={scrollRef}>
          <ul className="flex flex-col">
            {toc.map((item) => (
              <li key={item.url}>
                <TOCItem
                  href={item.url}
                  className="toc-link group/toc relative block py-[3px] pr-3 font-[family-name:var(--font-display)] text-[14px] leading-[1.4] text-[color:var(--muted-foreground)]"
                  style={{
                    paddingLeft: `${Math.max(0, item.depth - 2) * 12 + 16}px`,
                  }}
                >
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
