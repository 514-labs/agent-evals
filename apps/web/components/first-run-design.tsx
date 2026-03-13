"use client"

import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Download,
  GitBranch,
  KeyRound,
  Package,
  Play,
  Search,
  TerminalSquare,
} from "lucide-react"

type FeatureCardProps = {
  icon: LucideIcon
  eyebrow: string
  title: string
  detail: string
}

type FlowStep = {
  icon: LucideIcon
  step: string
  title: string
  detail: string
  command: string
}

const requirementCards: FeatureCardProps[] = [
  {
    icon: GitBranch,
    eyebrow: "Repo checkout",
    title: "Clone before build or run",
    detail: "The first-run flow reads scenarios, harness metadata, and Docker scripts from the repository root.",
  },
  {
    icon: Package,
    eyebrow: "Runtime",
    title: "Keep Docker up",
    detail: "The CLI is the product surface, but container builds and eval execution still depend on a healthy Docker daemon.",
  },
  {
    icon: KeyRound,
    eyebrow: "Agent access",
    title: "Export one real API key",
    detail: "The default path is Claude Code, so `ANTHROPIC_API_KEY` is the one key you need for the quickest successful first run.",
  },
]

const flowSteps: FlowStep[] = [
  {
    icon: GitBranch,
    step: "01",
    title: "Clone the repo",
    detail: "Start in the checkout so the CLI can resolve repo-local assets on the first try.",
    command: "git clone",
  },
  {
    icon: Download,
    step: "02",
    title: "Install the CLI",
    detail: "Use the hosted installer so the binary, version, and PATH guidance stay aligned.",
    command: "install.sh",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "Export the key",
    detail: "Set the agent credential before you run so the first eval does not fail on auth.",
    command: "ANTHROPIC_API_KEY",
  },
  {
    icon: Package,
    step: "04",
    title: "Build the image",
    detail: "Bake the default scenario image with the standard harness, runner, model, and version.",
    command: "dec-bench build",
  },
  {
    icon: Play,
    step: "05",
    title: "Run the eval",
    detail: "Let the default scenario complete end to end before you explore matrix runs or custom setups.",
    command: "dec-bench run",
  },
  {
    icon: Search,
    step: "06",
    title: "Inspect, then audit",
    detail: "Copy the real `run_id` from results and hand that exact value into the audit UI.",
    command: "results -> audit",
  },
]

function FeatureCard({ icon: Icon, eyebrow, title, detail }: FeatureCardProps) {
  return (
    <div className="dec-first-run-card">
      <div className="dec-first-run-card-header">
        <span className="dec-first-run-icon-wrap">
          <Icon className="dec-first-run-icon" aria-hidden="true" />
        </span>
        <span className="dec-first-run-eyebrow">{eyebrow}</span>
      </div>
      <h3 className="dec-first-run-card-title">{title}</h3>
      <p className="dec-first-run-card-copy">{detail}</p>
    </div>
  )
}

export function FirstRunRequirements() {
  return (
    <div className="not-prose dec-first-run-shell">
      <div className="dec-first-run-head">
        <div className="dec-first-run-intro">
          <p className="dec-first-run-kicker">First-run design brief</p>
          <h2 className="dec-first-run-title">Remove the hidden setup before you touch the CLI.</h2>
          <p className="dec-first-run-copy">
            DEC Bench feels great on first use when the repo checkout, Docker runtime, and agent
            credential are explicit up front instead of discovered through errors.
          </p>
        </div>
        <div className="dec-first-run-accent">
          <span className="dec-first-run-accent-label">Default path</span>
          <strong className="dec-first-run-accent-title">
            Claude Code + <code>ANTHROPIC_API_KEY</code>
          </strong>
          <p className="dec-first-run-accent-copy">
            Switch runners later if you want, but make the first success path narrow, obvious, and
            runnable.
          </p>
        </div>
      </div>

      <div className="dec-first-run-grid">
        {requirementCards.map((card) => (
          <FeatureCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  )
}

export function FirstRunPath() {
  return (
    <div className="not-prose dec-first-run-shell dec-first-run-shell--path">
      <div className="dec-first-run-path-top">
        <div>
          <p className="dec-first-run-kicker">Recommended first-run path</p>
          <h2 className="dec-first-run-title">Move through the workflow in one clean line.</h2>
        </div>

        <div className="dec-first-run-flowline" aria-hidden="true">
          {flowSteps.map((step, index) => (
            <span key={step.step} className="dec-first-run-flowline-item">
              <span className="dec-first-run-chip">{step.command}</span>
              {index < flowSteps.length - 1 ? <ArrowRight className="dec-first-run-flow-arrow" /> : null}
            </span>
          ))}
        </div>
      </div>

      <div className="dec-first-run-steps">
        {flowSteps.map(({ icon: Icon, step, title, detail, command }) => (
          <div key={step} className="dec-first-run-step">
            <div className="dec-first-run-step-header">
              <span className="dec-first-run-step-index">{step}</span>
              <Icon className="dec-first-run-step-icon" aria-hidden="true" />
            </div>
            <h3 className="dec-first-run-step-title">{title}</h3>
            <p className="dec-first-run-step-copy">{detail}</p>
            <div className="dec-first-run-step-footer">
              <span className="dec-first-run-chip">{command}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RunIdHint() {
  return (
    <div className="not-prose dec-run-id-callout">
      <div className="dec-run-id-marker">
        <TerminalSquare className="dec-run-id-marker-icon" aria-hidden="true" />
        <span>Run ID handoff</span>
      </div>
      <div className="dec-run-id-body">
        <h3 className="dec-run-id-title">Audit only becomes copy-pasteable after results prints the real ID.</h3>
        <p className="dec-run-id-copy">
          Use the <code>run_id</code> from the end of <code>dec-bench run</code> or the{" "}
          <code>Run ID: ...</code> line from <code>dec-bench results --latest</code>, then pass
          that exact value to <code>dec-bench audit open</code>.
        </p>
      </div>
    </div>
  )
}
