"use client"

import { useEffect, useRef, useState, useId } from "react"

export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, "-")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "var(--font-body), ui-monospace, monospace",
          securityLevel: "loose",
        })

        const { svg } = await mermaid.render(`mermaid-${id}`, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [code, id])

  if (error) {
    return (
      <div className="dec-mermaid border-destructive/50">
        <pre className="text-[12px] text-destructive whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  return <div ref={ref} className="dec-mermaid" />
}
