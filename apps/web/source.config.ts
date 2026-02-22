import { defineConfig, defineDocs } from "fumadocs-mdx/config"
import type { DocsCollection } from "fumadocs-mdx/config"
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins"
import { transformerTwoslash } from "fumadocs-twoslash"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"

export const docs: DocsCollection = defineDocs({
  dir: "content/docs",
})

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    rehypePlugins: (v) => [rehypeKatex, ...v],
    rehypeCodeOptions: {
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark",
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash(),
      ],
      langs: ["js", "jsx", "ts", "tsx", "sql", "python", "bash", "json", "yaml", "toml", "css", "html", "markdown", "xml"],
    },
  },
})
