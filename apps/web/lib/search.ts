import { createFromSource } from "fumadocs-core/search/server"

import { docsSource } from "@/lib/source"

export const docsSearch = createFromSource(docsSource)
