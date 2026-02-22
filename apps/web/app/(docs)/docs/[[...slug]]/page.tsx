import type { MDXContent } from "mdx/types"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { docsSource } from "@/lib/source"

export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  const seen = new Set<string>()
  const params: Array<{ slug: string[] }> = [{ slug: [] }]

  for (const entry of docsSource.generateParams("slug")) {
    const key = entry.slug.join("/")

    if (!seen.has(key)) {
      seen.add(key)
      params.push({ slug: entry.slug })
    }
  }

  return params
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const page = docsSource.getPage(slug)

  if (!page) {
    notFound()
  }

  const pageData = page.data as typeof page.data & { body: MDXContent }
  const Body = pageData.body
  const currentUrl = page.url

  return (
    <Card>
      <CardHeader>
        <div className="mb-2">
          <Badge variant="outline">Placeholder</Badge>
        </div>
        <CardTitle className="text-2xl">{page.data.title}</CardTitle>
        {page.data.description ? (
          <p className="text-sm text-muted-foreground">{page.data.description}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-4 leading-7 text-sm">
          <Body />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Current route: <code>{currentUrl}</code>
        </p>
      </CardContent>
    </Card>
  )
}
