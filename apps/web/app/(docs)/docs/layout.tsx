import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { DocsSearch } from "@/components/docs-search"
import { DocsTreeNav } from "@/components/docs-tree-nav"
import { docsSource } from "@/lib/source"

export const dynamic = "force-static"

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const currentUrl = `/${["docs", ...(slug ?? [])].join("/")}`

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="md:sticky md:top-6 md:h-fit">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <DocsTreeNav tree={docsSource.pageTree} currentUrl={currentUrl} />
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-6">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Search</CardTitle>
          </CardHeader>
          <CardContent>
            <DocsSearch />
          </CardContent>
        </Card>
        {children}
      </section>
    </div>
  )
}
