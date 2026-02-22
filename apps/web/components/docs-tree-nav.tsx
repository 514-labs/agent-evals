"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Node, Root } from "fumadocs-core/page-tree"
import type { ReactNode } from "react"

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@workspace/ui/components/sidebar"

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
            className={`text-[12px] tracking-wide !bg-transparent border-l-[3px] ${
              isActive
                ? "font-bold text-black border-[#FF10F0]"
                : "text-black/50 hover:text-black border-transparent"
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
              ? "font-bold text-black border-[#FF10F0]"
              : "text-black/50 hover:text-black border-transparent"
          }`}
        >
          <Link href={node.url}>{node.name}</Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const folderKey = node.$id ?? `folder-${String(node.name)}-${depth}`
  const isActive = node.index?.url === currentUrl

  return (
    <SidebarMenuItem key={folderKey}>
      {node.index ? (
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={`text-[12px] font-bold tracking-wide !bg-transparent border-l-[3px] ${
            isActive
              ? "text-black border-[#FF10F0]"
              : "text-black/60 hover:text-black border-transparent"
          }`}
        >
          <Link href={node.index.url}>{node.name}</Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton className="text-[12px] font-bold tracking-wide text-black/60 pointer-events-none !bg-transparent border-l-[3px] border-transparent">
          {node.name}
        </SidebarMenuButton>
      )}
      {node.children.length > 0 ? (
        <SidebarMenuSub className="border-l border-black/10 ml-3">
          {node.children.map((child) => renderNode(child, currentUrl, depth + 1))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

export function DocsTreeNav({ tree }: { tree: Root }) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {tree.children.map((node) => renderNode(node, pathname))}
    </SidebarMenu>
  )
}
