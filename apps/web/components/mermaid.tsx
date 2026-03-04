"use client"

import { useEffect, useRef, useState, useId } from "react"

export function Mermaid({ chart }: { chart: string }) {
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
          theme: "base",
          fontFamily: "var(--font-body), ui-monospace, monospace",
          securityLevel: "loose",
          themeVariables: {
            primaryColor: "#ffffff",
            primaryTextColor: "#0d0d0d",
            primaryBorderColor: "#0d0d0d",
            lineColor: "#0d0d0d",
            secondaryColor: "#f5f5f5",
            tertiaryColor: "#ffffff",
            fontSize: "13px",
            nodeBorder: "#0d0d0d",
            mainBkg: "#ffffff",
            nodeTextColor: "#0d0d0d",
            edgeLabelBackground: "#ffffff",
          },
          flowchart: {
            nodeSpacing: 30,
            rankSpacing: 40,
            curve: "linear",
            htmlLabels: true,
          },
        })

        const { svg } = await mermaid.render(`mermaid-${id}`, chart.replaceAll("\\n", "\n"))
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
  }, [chart, id])

  if (error) {
    return (
      <div className="dec-mermaid border-destructive/50">
        <pre className="text-sm text-destructive whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  return <div ref={ref} className="dec-mermaid" />
}
