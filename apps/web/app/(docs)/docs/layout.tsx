import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar";

import { DocsSearch } from "@/components/docs-search";
import { DocsTreeNav } from "@/components/docs-tree-nav";
import { Nav } from "@/components/nav";
import { docsSource } from "@/lib/source";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F9F7F3] text-[#1C1917] font-[family-name:var(--font-display)] overscroll-none">
      <Nav activeItem="docs" sticky={true} fullWidth={true} />

      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <Sidebar
          collapsible="offcanvas"
          className="top-[60px] h-[calc(100svh-60px)] border-r-[3px] border-[#1C1917]"
        >
          <SidebarHeader className="px-4 pt-4 pb-2">
            <DocsSearch />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent className="px-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <DocsTreeNav tree={docsSource.pageTree} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <div className="md:hidden border-b border-[#D6D3D1] px-4 py-2">
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
