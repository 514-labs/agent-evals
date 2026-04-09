import { Nav } from "../components/nav";
import { Footer } from "../components/footer";
import { HeroSection } from "../components/sections/hero-section";
import { AbstractSection } from "../components/sections/abstract-section";
import { GatesSection } from "../components/sections/gates-section";
import { VariablesSection } from "../components/sections/variables-section";
import { ScenariosSection } from "../components/sections/scenarios-section";
import { ResultsSection } from "../components/sections/results-section";
import { InfrastructureSection } from "../components/sections/infrastructure-section";
import { LimitationsSection } from "../components/sections/limitations-section";
import { OpenBenchmarkSection } from "../components/sections/open-benchmark-section";
import { AccessSection } from "../components/sections/access-section";
import { ReferencesSection } from "../components/sections/references-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] font-[family-name:var(--font-display)] overflow-x-clip">
      <Nav variant="paper" />
      <HeroSection />
      <main className="max-w-[52rem] mx-auto px-6">
        <AbstractSection />
        <GatesSection />
        <VariablesSection />
        <ScenariosSection />
        <ResultsSection />
        <InfrastructureSection />
        <LimitationsSection />
        <OpenBenchmarkSection />
        <AccessSection />
        <ReferencesSection />
      </main>
      <Footer />
    </div>
  );
}
