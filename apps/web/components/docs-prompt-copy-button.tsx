"use client"

import { useState } from "react"

export function DocsPromptCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="bg-[color:var(--card)] border border-[color:var(--sidebar)] rounded-[3px] px-3 py-1.5 flex items-center hover:border-[color:var(--foreground)] transition-colors"
    >
      <span className="font-[family-name:var(--font-mono)] font-bold text-[10px] tracking-[1px] uppercase text-[color:var(--chart-4)]">
        {copied ? "Copied" : "Copy Prompt"}
      </span>
    </button>
  )
}
