"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronRight } from "lucide-react"
import type { Node, Root } from "fumadocs-core/page-tree"
import type { ReactNode } from "react"

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui/components/collapsible"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@workspace/ui/components/sidebar"

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

function FolderNode({ node, currentUrl, depth }: { node: Node & { type: "folder" }; currentUrl: string; depth: number }) {
  const router = useRouter()
  const targetUrl = getFolderTargetUrl(node)
  const isActive = node.index?.url === currentUrl
  const [open, setOpen] = useState(hasActiveChild(node, currentUrl))

  function handleLabelClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    if (targetUrl) {
      router.push(targetUrl)
    }
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div className="flex items-center">
          <button
            type="button"
            onClick={targetUrl ? handleLabelClick : () => setOpen((prev) => !prev)}
            className={`text-[12px] tracking-wide border-l-[3px] cursor-pointer flex-1 p-2 rounded-md text-left ${
              isActive
                ? "font-bold text-black border-[#FF10F0]"
                : "text-black/90 hover:text-black border-transparent"
            }`}
          >
            {node.name}
          </button>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="p-1 text-black/40 hover:text-black transition-colors"
            >
              <ChevronRight className="size-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-[11px] mr-0 px-0 translate-x-0 border-l-0">
            {node.children.map((child) => renderNode(child, currentUrl, depth + 1))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function renderNode(node: Node, currentUrl: string, depth = 0): ReactNode {
  if (node.type === "separator") {
    return (
      <li
        key={node.$id ?? `${depth}-${String(node.name)}`}
        className="pt-4 pb-1 first:pt-0"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/40 px-2">
          {node.name ?? "Section"}
        </span>
      </li>
    )
  }

  if (node.type === "page") {
    const isActive = node.url === currentUrl

    if (depth > 0) {
      return (
        <SidebarMenuSubItem key={node.$id ?? node.url}>
          <SidebarMenuSubButton
            asChild
            isActive={isActive}
            className={`!text-[12px] tracking-wide !bg-transparent translate-x-0 border-l-[3px] ${
              isActive
                ? "!text-black border-[#FF10F0]"
                : "!text-black/90 hover:!text-black border-black/10"
            }`}
          >
            <Link href={node.url}>{node.name}</Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )
    }

    return (
      <SidebarMenuItem key={node.$id ?? node.url}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={`text-[12px] tracking-wide !bg-transparent border-l-[3px] ${
            isActive
              ? "font-bold !text-black border-[#FF10F0]"
              : "!text-black/90 hover:!text-black border-transparent"
          }`}
        >
          <Link href={node.url}>{node.name}</Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const folderKey = node.$id ?? `folder-${String(node.name)}-${depth}`
  const isActive = node.index?.url === currentUrl

  if (node.children.length === 0) {
    return (
      <SidebarMenuItem key={folderKey}>
        {node.index ? (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className={`text-[12px] tracking-wide !bg-transparent border-l-[3px] ${
              isActive
                ? "font-bold !text-black border-[#FF10F0]"
                : "!text-black/90 hover:!text-black border-transparent"
            }`}
          >
            <Link href={node.index.url}>{node.name}</Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton className="text-[12px] tracking-wide !text-black/90 pointer-events-none !bg-transparent border-l-[3px] border-transparent">
            {node.name}
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    )
  }

  return <FolderNode key={folderKey} node={node} currentUrl={currentUrl} depth={depth} />
}

export function DocsTreeNav({ tree }: { tree: Root }) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {tree.children.map((node) => renderNode(node, pathname))}
    </SidebarMenu>
  )
}
