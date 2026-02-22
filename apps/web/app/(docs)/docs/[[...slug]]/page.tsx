import type { MDXContent } from "mdx/types"
import type { TableOfContents } from "fumadocs-core/toc"
import { notFound } from "next/navigation"

import { DocsToc } from "@/components/docs-toc"
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

  const pageData = page.data as typeof page.data & {
    body: MDXContent
    toc?: TableOfContents
  }
  const Body = pageData.body
  const toc = pageData.toc ?? []

  return (
    <div className="relative grid xl:grid-cols-[1fr_200px] gap-0">
      {/* Content */}
      <article className="min-w-0 px-8 lg:px-14 py-10 max-w-3xl">
        <div className="pb-6 mb-8 border-b-[3px] border-black">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/40 block mb-3">DOCUMENTATION</span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-5xl tracking-tight uppercase leading-[0.9]">
            {page.data.title}
          </h1>
          {page.data.description ? (
            <p className="mt-3 text-[13px] text-black/50 leading-relaxed max-w-xl">
              {page.data.description}
            </p>
          ) : null}
        </div>

        <div className="dec-prose">
          <Body />
        </div>
      </article>

      {/* TOC — fixed to viewport */}
      {toc.length > 0 && (
        <aside className="hidden xl:block">
          <div className="fixed top-[104px] w-[200px] pr-6 max-h-[calc(100vh-120px)] overflow-y-auto">
            <DocsToc toc={toc} />
          </div>
        </aside>
      )}
    </div>
  )
}
