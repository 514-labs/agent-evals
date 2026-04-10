import { Nav } from "../components/nav";
import { Footer } from "../components/footer";
import { HeroSection } from "../components/sections/hero-section";
import { AbstractSection } from "../components/sections/abstract-section";
import { GatesSection } from "../components/sections/gates-section";
import { VariablesSection } from "../components/sections/variables-section";
import { MethodologySection } from "../components/sections/methodology-section";
import { ScenariosSection } from "../components/sections/scenarios-section";
import { LimitationsSection } from "../components/sections/limitations-section";
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
        <MethodologySection />
        <ScenariosSection />
        <LimitationsSection />
        <AccessSection />
        <ReferencesSection />
      </main>
      <Footer />
    </div>
  );
}
