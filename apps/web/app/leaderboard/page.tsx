import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export const dynamic = "force-static"

const placeholderRows = [
  { rank: "--", team: "TBD", score: "--" },
  { rank: "--", team: "TBD", score: "--" },
  { rank: "--", team: "TBD", score: "--" },
]

export default function LeaderboardPage() {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2">
          <Badge variant="outline">Placeholder</Badge>
        </div>
        <CardTitle className="text-2xl">Leaderboard</CardTitle>
        <p className="text-sm text-muted-foreground">
          Static leaderboard shell. Data source and ranking logic to be implemented.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholderRows.map((row, index) => (
              <TableRow key={`${row.rank}-${index}`}>
                <TableCell>{row.rank}</TableCell>
                <TableCell>{row.team}</TableCell>
                <TableCell>{row.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
