import { loader } from "fumadocs-core/source"
import type { Source } from "fumadocs-core/source"

import { docs as generatedDocs } from "@/.source/server"

type GeneratedDocs = {
  toFumadocsSource: () => Source
}

const docs = generatedDocs as unknown as GeneratedDocs

export const docsSource = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
})
