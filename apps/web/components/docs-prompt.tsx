import "server-only"

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { DocsPromptCopyButton } from "@/components/docs-prompt-copy-button"

export type PromptVariant = "baseline" | "informed"

export type PromptProps = {
  /** Scenario slug, e.g. `foo-bar-csv-ingest`. Resolves `scenarios/<slug>/prompts/<variant>.md`. */
  scenario?: string
  /** Which prompt variant to render. Defaults to `baseline`. */
  variant?: PromptVariant
  /** Inline override: pass raw prompt text directly instead of reading from disk. */
  text?: string
  /** Optional override for the small left-footer label. Defaults to `<variant>`. */
  label?: string
}

function resolveScenariosDir(): string {
  const candidates = [
    join(process.cwd(), "scenarios"),
    join(process.cwd(), "..", "..", "scenarios"),
    join(process.cwd(), "apps", "web", "..", "..", "scenarios"),
  ]
  for (const candidate of candidates) {
    const abs = resolve(candidate)
    if (existsSync(abs)) return abs
  }
  return resolve(join(process.cwd(), "..", "..", "scenarios"))
}

function readPromptFile(scenario: string, variant: PromptVariant): string | null {
  const dir = resolveScenariosDir()
  const filePath = join(dir, scenario, "prompts", `${variant}.md`)
  if (!existsSync(filePath)) return null
  try {
    return readFileSync(filePath, "utf8").trim()
  } catch {
    return null
  }
}

export function Prompt({
  scenario,
  variant = "baseline",
  text,
  label,
}: PromptProps) {
  const content =
    text?.trim() ?? (scenario ? readPromptFile(scenario, variant) : null)

  if (!content) {
    return (
      <div className="not-prose my-6 rounded-[3px] border border-dashed border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-[13px] text-[color:var(--muted-foreground)] font-[family-name:var(--font-display)]">
        Prompt not found
        {scenario ? (
          <>
            {" "}for <code>{scenario}</code> · <code>{variant}</code>
          </>
        ) : null}
        .
      </div>
    )
  }

  // Figma spec: the left footer slot is an empty 32x32 placeholder and the
  // right side holds the COPY PROMPT button. No inline variant/scenario
  // caption inside the card. The `label` prop is retained for backwards
  // compatibility but is no longer rendered on the card itself.
  void label

  return (
    <div className="not-prose my-6 w-full rounded-[3px] border border-[color:var(--chart-4)] bg-[color:var(--background)] p-px shadow-[0px_1px_2px_0_rgba(0,0,0,0.05)]">
      <div className="p-3 min-h-[64px] max-h-[240px] overflow-auto">
        <p className="whitespace-pre-wrap font-[family-name:var(--font-display)] font-normal text-[14px] leading-[26px] text-[color:var(--muted-foreground)]">
          {content}
        </p>
      </div>
      <div className="flex h-10 items-center justify-between border-t border-[color:var(--border)] px-3 pt-[13px] pb-3">
        <span aria-hidden="true" className="size-8 shrink-0" />
        <DocsPromptCopyButton text={content} />
      </div>
    </div>
  )
}
