import { harnesses, scenarios } from "@/data/registry"

import { HarnessShowcase } from "@/components/harness-showcase"

export function HarnessShowcaseBlock() {
  const harnessesWithCounts = harnesses.map((h) => ({
    ...h,
    scenarioCount: scenarios.filter((s) => s.harnesses.includes(h.id)).length,
  }))

  return (
    <div className="not-prose">
      <HarnessShowcase harnesses={harnessesWithCounts} />
    </div>
  )
}
