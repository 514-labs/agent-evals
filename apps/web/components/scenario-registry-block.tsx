import {
  competencies,
  domains,
  features,
  harnesses,
  scenarios,
  startingStates,
  taskCategories,
  tiers,
} from "@/data/registry";
import { upNext } from "@/flags";

import { ScenarioRegistry } from "@/components/scenario-registry";

export async function ScenarioRegistryBlock({
  view,
}: {
  view?: "all" | "scenarios" | "harnesses"
} = {}) {
  const showUpNext = await upNext();

  const filteredScenarios = showUpNext
    ? scenarios
    : scenarios.filter((s) => s.domain === "foo-bar");

  const filteredDomains = showUpNext
    ? domains
    : domains.filter((d) => d.slug === "foo-bar");

  return (
    <div className="not-prose">
      <ScenarioRegistry
        view={view}
        scenarios={filteredScenarios}
        harnesses={harnesses}
        domains={filteredDomains}
        competencies={competencies}
        features={features}
        taskCategories={taskCategories}
        tiers={tiers}
        startingStates={startingStates}
      />
    </div>
  );
}
