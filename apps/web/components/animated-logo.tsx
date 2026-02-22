"use client"

import { useEffect, useState } from "react"

const FULL_TEXT = "DATA ENGINEERING COMPETENCY"
const TARGET = "DEC"
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-—+×=/:;%#&@"
const HOLD_MS = 2000
const TICK_MS = 80

function pickGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!
}

const TARGET_INDICES = [0, 5, 17]

export function AnimatedLogo() {
  const [chars, setChars] = useState(() => FULL_TEXT.split(""))
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      let current = FULL_TEXT.split("")
      let tick = 0
      let removableIndices = current
        .map((_, i) => i)
        .filter((i) => !TARGET_INDICES.includes(i))

      const interval = setInterval(() => {
        tick++

        current = current.map((ch, i) => {
          if (TARGET_INDICES.includes(i)) return ch
          if (ch === "") return ""
          return pickGlyph()
        })

        if (tick % 2 === 0 && removableIndices.length > 0) {
          const removeCount = Math.random() < 0.4 ? 2 : 1
          for (let r = 0; r < removeCount && removableIndices.length > 0; r++) {
            const pick = Math.floor(Math.random() * removableIndices.length)
            const idx = removableIndices[pick]!
            removableIndices.splice(pick, 1)
            current[idx] = ""
          }
        }

        const display = current.filter((ch) => ch !== "")
        setChars(display)

        if (removableIndices.length === 0) {
          clearInterval(interval)
          setChars(TARGET.split(""))
          setDone(true)
        }
      }, TICK_MS)

      return () => clearInterval(interval)
    }, HOLD_MS)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight whitespace-nowrap overflow-hidden inline-flex">
      {chars.map((ch, i) => (
        <span
          key={`${done ? "f" : "a"}-${i}`}
          className="inline-block text-center"
          style={{ width: ch === " " ? "0.3em" : "auto" }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  )
}
