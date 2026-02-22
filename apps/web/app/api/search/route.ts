import { docsSearch } from "@/lib/search"

export const dynamic = "force-static"
export const revalidate = false

export async function GET() {
  return docsSearch.staticGET()
}
