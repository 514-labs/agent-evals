"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { Node, Root } from "fumadocs-core/page-tree"
import type { ReactNode } from "react"

function hasActiveChild(node: Node, currentUrl: string): boolean {
  if (node.type === "page") return node.url === currentUrl
  if (node.type === "folder") {
    if (node.index?.url === currentUrl) return true
    return node.children.some((child) => hasActiveChild(child, currentUrl))
  }
  return false
}

function getFolderTargetUrl(node: Node & { type: "folder" }): string | undefined {
  if (node.index?.url) return node.index.url

  for (const child of node.children) {
    if (child.type === "page") return child.url
    if (child.type === "folder") {
      const nested = getFolderTargetUrl(child)
      if (nested) return nested
    }
  }

  return undefined
}

// Keep the base class color-free so active/inactive states don't collide
// (Tailwind can't pick a winner between two arbitrary-value color utilities
// at the same specificity, which previously made the active state unreliable).
const linkBase =
  "flex items-center justify-between w-full px-4 py-[5px] font-[family-name:var(--font-display)] text-[14px] leading-[26px] transition-colors border-l-2"

const linkInactive =
  "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] border-transparent"

const linkActive =
  "text-[color:var(--accent)] font-semibold border-[color:var(--accent)] bg-[color:var(--secondary)]"

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-1 pt-0">
      <span className="font-[family-name:var(--font-display)] text-[14px] leading-[26px] font-normal text-[color:var(--foreground)]">
        {children}
      </span>
    </div>
  )
}

function PageLink({
  href,
  label,
  active,
  hasChildren = false,
}: {
  href: string
  label: ReactNode
  active: boolean
  hasChildren?: boolean
}) {
  return (
    <Link href={href} className={`${linkBase} ${active ? linkActive : linkInactive}`}>
      <span className="truncate">{label}</span>
      {hasChildren ? (
        <span className="shrink-0 text-[color:var(--chart-4)] text-[14px] leading-none pl-2">›</span>
      ) : null}
    </Link>
  )
}

function FolderBranch({
  node,
  currentUrl,
  depth,
}: {
  node: Node & { type: "folder" }
  currentUrl: string
  depth: number
}) {
  const router = useRouter()
  const target = getFolderTargetUrl(node)
  const isActive = node.index?.url === currentUrl
  const containsActive = hasActiveChild(node, currentUrl)
  const [open, setOpen] = useState(containsActive)

  useEffect(() => {
    if (containsActive) setOpen(true)
  }, [containsActive])

  const toggleOrNavigate = (e: React.MouseEvent) => {
    e.preventDefault()
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen && target) router.push(target)
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={toggleOrNavigate}
        className={`${linkBase} ${isActive ? linkActive : linkInactive}`}
        aria-expanded={open}
      >
        <span className="truncate">{node.name}</span>
        <span
          className={`shrink-0 text-[color:var(--chart-4)] text-[14px] leading-none pl-2 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>
      {open ? (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <div key={keyFor(child, depth + 1)} className="pl-3">
              {renderNode(child, currentUrl, depth + 1)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function keyFor(node: Node, depth: number): string {
  if (node.type === "separator") return `sep-${depth}-${String(node.name)}`
  if (node.type === "page") return node.$id ?? node.url
  return node.$id ?? `folder-${depth}-${String(node.name)}`
}

function renderNode(node: Node, currentUrl: string, depth = 0): ReactNode {
  if (node.type === "separator") {
    return <GroupLabel>{node.name ?? "Section"}</GroupLabel>
  }

  if (node.type === "page") {
    const isActive = node.url === currentUrl
    return (
      <PageLink href={node.url} label={node.name} active={isActive} />
    )
  }

  const isActive = node.index?.url === currentUrl

  if (node.children.length === 0) {
    if (!node.index) {
      return (
        <div className={`${linkBase} ${linkInactive}`} aria-disabled>
          <span className="truncate">{node.name}</span>
        </div>
      )
    }
    return (
      <PageLink href={node.index.url} label={node.name} active={isActive} />
    )
  }

  return <FolderBranch node={node} currentUrl={currentUrl} depth={depth} />
}

function groupSections(nodes: Node[]): Array<{ label: string | null; items: Node[] }> {
  const sections: Array<{ label: string | null; items: Node[] }> = []
  let current: { label: string | null; items: Node[] } = { label: null, items: [] }
  sections.push(current)

  for (const node of nodes) {
    if (node.type === "separator") {
      current = { label: String(node.name ?? "Section"), items: [] }
      sections.push(current)
      continue
    }
    current.items.push(node)
  }

  return sections.filter((section) => section.items.length > 0)
}

export function DocsTreeNav({ tree }: { tree: Root }) {
  const pathname = usePathname()
  const sections = groupSections(tree.children)

  return (
    <nav className="flex flex-col">
      {sections.map((section, idx) => (
        <div
          key={section.label ?? `section-${idx}`}
          className={idx > 0 ? "pt-5" : ""}
        >
          {section.label ? (
            <GroupLabel>{section.label}</GroupLabel>
          ) : null}
          <div className="flex flex-col">
            {section.items.map((node) => (
              <div key={keyFor(node, 0)}>{renderNode(node, pathname)}</div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
