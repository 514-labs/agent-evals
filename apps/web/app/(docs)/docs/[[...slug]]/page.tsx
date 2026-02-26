import type { MDXContent } from "mdx/types"
import type { TableOfContents } from "fumadocs-core/toc"
import { notFound } from "next/navigation"

import { File, Folder, Files } from "fumadocs-ui/components/files"

import { DocsToc, TocAnchorProvider } from "@/components/docs-toc"
import { EmptyState } from "@/components/empty-state"
import { RoadmapTimeline } from "@/components/roadmap-timeline"
import { ScenarioRegistryBlock } from "@/components/scenario-registry-block"
import { docsSource } from "@/lib/source"
import { useMDXComponents } from "@/mdx-components"

const mdxComponents = useMDXComponents({
  EmptyState,
  File,
  Files,
  Folder,
  RoadmapTimeline,
  ScenarioRegistry: ScenarioRegistryBlock,
})

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
    <TocAnchorProvider toc={toc}>
      <div className="relative grid xl:grid-cols-[minmax(0,1fr)_200px] gap-0">
        {/* Content */}
        <article className="min-w-0 w-full container mx-auto px-8 lg:px-14 py-10">
          <div className="max-w-prose mx-auto">
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
              <Body components={mdxComponents} />
            </div>
          </div>
        </article>

        {/* TOC — fixed to viewport */}
        {toc.length > 0 && (
          <aside className="hidden xl:block">
            <div className="fixed top-[104px] w-[200px] pr-6">
              <DocsToc toc={toc} />
            </div>
          </aside>
        )}
      </div>
    </TocAnchorProvider>
  )
}
