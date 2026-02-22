"use client"

import { useEffect, useState } from "react"
import type { TableOfContents } from "fumadocs-core/toc"

export function DocsToc({ toc }: { toc: TableOfContents }) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    if (toc.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0 }
    )

    const headings = toc
      .map((item) => {
        const id = item.url.replace("#", "")
        return document.getElementById(id)
      })
      .filter(Boolean) as HTMLElement[]

    for (const heading of headings) {
      observer.observe(heading)
    }

    return () => observer.disconnect()
  }, [toc])

  if (toc.length === 0) return null

  return (
    <nav>
      <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/40 block mb-3">
        ON THIS PAGE
      </span>
      <ul className="space-y-0.5">
        {toc.map((item) => {
          const id = item.url.replace("#", "")
          const isActive = activeId === id

          return (
            <li key={item.url}>
              <a
                href={item.url}
                className={`block py-1 text-[11px] tracking-wide transition-colors border-l-[2px] pl-3 ${
                  isActive
                    ? "font-bold text-black border-[#FF10F0]"
                    : "text-black/35 hover:text-black/60 border-transparent"
                }`}
                style={{ paddingLeft: `${(item.depth - 2) * 0.5 + 0.75}rem` }}
              >
                {item.title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
