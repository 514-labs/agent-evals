import type { MDXContent } from "mdx/types"
import type { TableOfContents } from "fumadocs-core/toc"
import Link from "next/link"
import { notFound } from "next/navigation"

import { File, Folder, Files } from "fumadocs-ui/components/files"

import { DocsToc, TocAnchorProvider } from "@/components/docs-toc"
import { Prompt } from "@/components/docs-prompt"
import { EmptyState } from "@/components/empty-state"
import { HarnessShowcaseBlock } from "@/components/harness-showcase-block"
import { RoadmapTimeline } from "@/components/roadmap-timeline"
import { ScenarioRegistryBlock } from "@/components/scenario-registry-block"
import { getAdjacentPages } from "@/lib/docs-navigation"
import { isPublished } from "@/lib/published-docs"
import { docsSource } from "@/lib/source"
import { useMDXComponents } from "@/mdx-components"

function ScenariosRegistryBlock() {
  return <ScenarioRegistryBlock view="scenarios" />
}

const mdxComponents = useMDXComponents({
  EmptyState,
  File,
  Files,
  Folder,
  HarnessShowcase: HarnessShowcaseBlock,
  Prompt,
  RoadmapTimeline,
  ScenarioRegistry: ScenarioRegistryBlock,
  ScenariosRegistry: ScenariosRegistryBlock,
})

export function generateStaticParams() {
  const seen = new Set<string>();
  const params: Array<{ slug: string[] }> = [{ slug: [] }];

  for (const entry of docsSource.generateParams("slug")) {
    const key = entry.slug.join("/");

    if (!seen.has(key)) {
      seen.add(key);
      params.push({ slug: entry.slug });
    }
  }

  return params;
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params

  if (!isPublished(slug)) {
    notFound()
  }

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
  const { previous, next } = getAdjacentPages(slug)

  return (
    <TocAnchorProvider toc={toc}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,900px)_208px]">
        <article className="min-w-0 px-6 md:px-10 pt-10 md:pt-12 pb-16 xl:border-r border-[color:var(--border)]">
          <div className="max-w-[820px] mx-auto">
            <header className="flex flex-col gap-[18px]">
              <p className="font-[family-name:var(--font-display)] font-bold uppercase text-[10px] tracking-[0.1em] text-[color:var(--chart-4)]">
                Documentation
              </p>
              <h1 className="font-[family-name:var(--font-display)] font-semibold text-[36px] md:text-[44px] leading-[1.15] text-[color:var(--foreground)]">
                {page.data.title}
              </h1>
              {page.data.description ? (
                <p className="font-[family-name:var(--font-display)] text-[18px] leading-[28px] text-[color:var(--muted-foreground)] max-w-[680px]">
                  {page.data.description}
                </p>
              ) : null}
            </header>

            <div className="dec-prose mt-10">
              <Body components={mdxComponents} />
            </div>

            {previous || next ? (
              <nav
                aria-label="Pagination"
                className="mt-14 pt-8 border-t border-[color:var(--border)] flex items-center justify-between gap-4"
              >
                <div>
                  {previous ? (
                    <Link
                      href={previous.url}
                      className="inline-flex items-center gap-[8px] h-8 border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--foreground)] transition-colors"
                    >
                      <ArrowLeft />
                      <span className="font-[family-name:var(--font-display)] font-bold text-[12px] leading-none">
                        {previous.title}
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
                <div>
                  {next ? (
                    <Link
                      href={next.url}
                      className="inline-flex items-center gap-[8px] h-8 border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--foreground)] transition-colors"
                    >
                      <span className="font-[family-name:var(--font-display)] font-bold text-[12px] leading-none">
                        {next.title}
                      </span>
                      <ArrowRight />
                    </Link>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </div>
        </article>

        {toc.length > 0 ? (
          <aside className="hidden xl:block">
            <div className="sticky top-[60px] px-5 pt-10 pb-9 w-[208px]">
              <DocsToc toc={toc} />
            </div>
          </aside>
        ) : null}
      </div>
    </TocAnchorProvider>
  )
}

function ArrowLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
