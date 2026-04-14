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

import type { Node, Root } from "fumadocs-core/page-tree";

import { DocsSearch } from "@/components/docs-search";
import { DocsTreeNav } from "@/components/docs-tree-nav";
import { Nav } from "@/components/nav";
import { isPublished } from "@/lib/published-docs";
import { docsSource } from "@/lib/source";

function slugFromUrl(url: string): string[] {
  return url.replace(/^\/docs\/?/, "").split("/").filter(Boolean);
}

function filterTree(nodes: Node[]): Node[] {
  const filtered: Node[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    if (node.type === "separator") {
      // Only keep a separator if there's visible content before the next separator
      const section: Node[] = [];
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j]!.type === "separator") break;
        section.push(nodes[j]!);
      }
      if (filterTree(section).length > 0) filtered.push(node);
      continue;
    }

    if (node.type === "page") {
      if (isPublished(slugFromUrl(node.url))) filtered.push(node);
      continue;
    }

    if (node.type === "folder") {
      const children = filterTree(node.children);
      const indexVisible = node.index ? isPublished(slugFromUrl(node.index.url)) : false;
      if (children.length > 0 || indexVisible) {
        filtered.push({ ...node, children });
      }
    }
  }

  return filtered;
}

function getPublishedTree(): Root {
  const tree = docsSource.pageTree;
  return { ...tree, children: filterTree(tree.children) };
}

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
                <DocsTreeNav tree={getPublishedTree()} />
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
