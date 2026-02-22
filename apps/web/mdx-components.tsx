import type { MDXComponents } from "mdx/types"
import defaultComponents from "fumadocs-ui/mdx"
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock"
import * as Twoslash from "fumadocs-twoslash/ui"
import { Mermaid } from "@/components/mermaid"
import { Children, isValidElement, type ReactNode } from "react"

function extractTextContent(node: ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (!isValidElement(node)) return ""
  const { children } = node.props as { children?: ReactNode }
  if (!children) return ""
  if (typeof children === "string") return children
  if (Array.isArray(children)) {
    return Children.map(children, extractTextContent)?.join("") ?? ""
  }
  return extractTextContent(children)
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...Twoslash,
    pre: ({ ref: _ref, ...props }: React.ComponentProps<"pre"> & { ref?: React.Ref<HTMLPreElement> }) => {
      const child = Children.only(props.children)
      if (isValidElement(child)) {
        const className = (child.props as Record<string, unknown>).className
        if (typeof className === "string" && className.includes("language-mermaid")) {
          const code = extractTextContent(child)
          return <Mermaid code={code} />
        }
      }

      return (
        <CodeBlock {...props}>
          <Pre>{props.children}</Pre>
        </CodeBlock>
      )
    },
    ...components,
  }
}
