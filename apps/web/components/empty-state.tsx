import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"

export function EmptyState({
  title = "Nothing here yet",
  description = "Check back soon for updates.",
}: {
  title?: string
  description?: string
}) {
  return (
    <Card className="border-[2px] border-dashed border-black/15 bg-transparent ring-0 w-full">
      <CardHeader>
        <CardTitle className="text-black/40 text-sm">{title}</CardTitle>
        <CardDescription className="text-black/30 text-sm">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
