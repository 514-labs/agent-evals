import {
  competencies,
  domains,
  features,
  harnesses,
  scenarios,
  startingStates,
  taskCategories,
  tiers,
} from "@/data/registry"

import { ScenarioRegistry } from "@/components/scenario-registry"

export function ScenarioRegistryBlock() {
  return (
    <div className="not-prose">
    <ScenarioRegistry
      scenarios={scenarios}
      harnesses={harnesses}
      domains={domains}
      competencies={competencies}
      features={features}
      taskCategories={taskCategories}
      tiers={tiers}
      startingStates={startingStates}
    />
    </div>
  )
}
