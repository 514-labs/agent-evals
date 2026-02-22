import Link from "next/link"
import type { Node, Root } from "fumadocs-core/page-tree"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

function renderNode(node: Node, currentUrl: string, depth = 0): ReactNode {
  if (node.type === "separator") {
    return (
      <li
        key={node.$id ?? `${depth}-${String(node.name)}`}
        className="pt-3 text-xs uppercase text-muted-foreground"
      >
        {node.name ?? "Section"}
      </li>
    )
  }

  if (node.type === "page") {
    const isActive = node.url === currentUrl

    return (
      <li key={node.$id ?? node.url}>
        <Link
          href={node.url}
          className={cn(
            "block rounded-md px-2 py-1.5 text-sm hover:bg-muted",
            isActive && "bg-muted font-medium"
          )}
          style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
        >
          {node.name}
        </Link>
      </li>
    )
  }

  const folderKey = node.$id ?? `folder-${String(node.name)}-${depth}`
  const folderLabel = node.index ? (
    <Link
      href={node.index.url}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted",
        node.index.url === currentUrl && "bg-muted"
      )}
      style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
    >
      {node.name}
    </Link>
  ) : (
    <p
      className="px-2 py-1.5 text-sm font-medium"
      style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
    >
      {node.name}
    </p>
  )

  return (
    <li key={folderKey} className="space-y-1">
      {folderLabel}
      {node.children.length > 0 ? (
        <ul className="space-y-1">
          {node.children.map((child) => renderNode(child, currentUrl, depth + 1))}
        </ul>
      ) : null}
    </li>
  )
}

export function DocsTreeNav({ tree, currentUrl }: { tree: Root; currentUrl: string }) {
  return <ul className="space-y-1">{tree.children.map((node) => renderNode(node, currentUrl))}</ul>
}
