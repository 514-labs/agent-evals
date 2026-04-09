import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";

export function MethodologySection() {
  return (
    <section id="methodology" className="pt-10">
      <SectionHeading number={4} title="Methodology" />

      <div className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-4">
        <p>
          Each scenario defines three inputs: a starting state, a prompt, and a
          set of tests. The starting state is an isolated Docker container
          running supervised processes provisioned with seed data and
          infrastructure (e.g. a Postgres database with tables, a ClickHouse
          instance, a Redpanda cluster). The prompt is a single
          natural-language description of the task. The tests are TypeScript
          assertion functions organized into the five quality gates.
        </p>
        <p>
          A run pairs one agent, one tooling harness, and one prompt variant
          against one scenario. The agent receives the prompt and a working
          environment, then operates autonomously with no human interaction.
          The agent may use tools and iterate internally, but there is no
          conversational back-and-forth with a user. Every run produces a
          structured trace capturing the agent&apos;s reasoning steps, tool
          calls (shell commands, file edits, API requests), tool results,
          token usage, and wall-clock timing. When the agent signals
          completion, its output is evaluated automatically against the gate
          assertions and the trace is persisted alongside the scored result
          for comparison and analysis.
        </p>
        <p>
          Gates are evaluated sequentially. Each gate has two kinds of checks:
          core assertions shared across all scenarios (e.g. clean process exit,
          no secrets in code) that must all pass, and scenario-specific
          assertions that are graded as a group with a pass threshold of 80%.
          A gate clears only when both conditions are met. The normalized score
          combines fully cleared gates with partial credit on the first failed
          gate, scaled to a 0&ndash;1 range.
        </p>
      </div>

      <div className="mt-4">
        <Link
          href="https://github.com/514-labs/dec-bench"
          target="_blank"
          rel="noopener noreferrer"
          className="paper-btn paper-btn-primary px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold"
        >
          See Repo
        </Link>
      </div>
    </section>
  );
}
