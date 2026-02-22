import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export const dynamic = "force-static"

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="mb-2">
            <Badge variant="outline">Placeholder</Badge>
          </div>
          <CardTitle className="text-2xl">rad-bench web scaffold</CardTitle>
          <p className="text-sm text-muted-foreground">
            Static-first shell with route scaffolding for home, docs, and leaderboard.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Docs section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fumadocs headless integration with placeholder content and custom shadcn UI layout.
          </p>
          <Button asChild>
            <Link href="/docs">Open docs</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Static leaderboard route with placeholder table rows.
          </p>
          <Button asChild variant="outline">
            <Link href="/leaderboard">Open leaderboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
