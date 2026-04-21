import { DocsBreadcrumbBar } from "@/components/docs-breadcrumb-bar";
import { DocsSearch } from "@/components/docs-search";
import { DocsTreeNav } from "@/components/docs-tree-nav";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { getPublishedTree } from "@/lib/docs-navigation";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = getPublishedTree();

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] font-[family-name:var(--font-display)]">
      <Nav activeItem="docs" sticky={true} fullWidth={true} />

      <DocsBreadcrumbBar tree={tree} />

      <div className="mx-auto w-full max-w-[1328px] flex flex-col lg:flex-row items-stretch">
        <aside
          className="shrink-0 w-full lg:w-[220px] border-b lg:border-b-0 border-[color:var(--border)] px-4 pt-6 lg:pt-10 pb-6 lg:pb-12 lg:sticky lg:top-[60px] lg:self-start lg:max-h-[calc(100vh-60px)] lg:overflow-y-auto"
          aria-label="Docs navigation"
        >
          <div className="pb-5 lg:pb-6">
            <DocsSearch />
          </div>
          <DocsTreeNav tree={tree} />
        </aside>

        <div className="flex-1 min-w-0 lg:border-l lg:border-[color:var(--border)]">
          {children}
        </div>
      </div>

      <Footer maxWidth="1328px" marginTop="0" />
    </div>
  );
}
