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
import { upNext } from "@/flags";
import { docsSource } from "@/lib/source";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showUpNext = await upNext();

  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-body)] overscroll-none">
      <Nav showLeaderboard={showUpNext} activeItem="docs" sticky={true} fullWidth={true} />

      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <Sidebar
          collapsible="offcanvas"
          className="top-[60px] h-[calc(100svh-60px)] border-r-[3px] border-black"
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
          <div className="md:hidden border-b border-black/10 px-4 py-2">
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
