import { SectionHeading } from "../marketing/section-heading";
import { FiveGates } from "../marketing/five-gates";

export function GatesSection() {
  return (
    <section id="introduction" className="pt-10">
      <SectionHeading number={1} title="Five-Gate Evaluation Model" />

      <div className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-4">
        <p>
          The evaluation model uses five sequential quality gates. Gates are
          strictly ordered: an agent must clear each gate before the next is
          evaluated. A solution that produces correct output but crashes on edge
          cases clears G2 (Correct) but fails at G3 (Robust). A solution that
          handles edge cases but misses latency targets clears G3 but fails at G4
          (Performant).
        </p>
        <p>
          This sequential structure is deliberate. Aggregate pass/fail scores hide
          where agents struggle. Gate attrition curves reveal the shape of
          quality: two agents with the same final score can have very different
          failure profiles.
        </p>
      </div>

      <div className="mt-8">
        <FiveGates />
      </div>
    </section>
  );
}
