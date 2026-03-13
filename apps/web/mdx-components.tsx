import type { MDXComponents } from "mdx/types"
import defaultComponents from "fumadocs-ui/mdx"
import * as Twoslash from "fumadocs-twoslash/ui"
import { FirstRunPath, FirstRunRequirements, RunIdHint } from "@/components/first-run-design"
import { Mermaid } from "@/components/mermaid"

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...Twoslash,
    FirstRunPath,
    FirstRunRequirements,
    Mermaid,
    RunIdHint,
    ...components,
  }
}
