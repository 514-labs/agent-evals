import Link from "next/link"

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar"

import { DocsSearch } from "@/components/docs-search"
import { DocsTreeNav } from "@/components/docs-tree-nav"
import { docsSource } from "@/lib/source"

export const dynamic = "force-static"

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      {/* Full-width top nav — matches landing page */}
      <nav className="sticky top-0 z-50 border-b-[3px] border-black bg-white">
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            DEC
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-[11px] font-bold uppercase tracking-[0.15em] bg-black text-white px-3 py-1.5">DOCS</Link>
            <Link href="/leaderboard" className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#FF10F0] px-3 py-1.5 transition-colors">LEADERBOARD</Link>
            <a href="https://github.com/514-labs/agent-evals" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold uppercase tracking-[0.15em] border-[2px] border-black px-3 py-1 hover:bg-black hover:text-white transition-all">GH ↗</a>
          </div>
        </div>
      </nav>

      {/* Docs body */}
      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <Sidebar collapsible="offcanvas" className="top-[60px] h-[calc(100svh-60px)] border-r-[3px] border-black">
          <SidebarHeader className="px-4 pt-4 pb-2">
            <DocsSearch />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent className="px-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/40 px-2 h-6 mb-0">
                NAVIGATION
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <DocsTreeNav tree={docsSource.pageTree} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          {/* Mobile sidebar trigger */}
          <div className="md:hidden border-b border-black/10 px-4 py-2">
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
