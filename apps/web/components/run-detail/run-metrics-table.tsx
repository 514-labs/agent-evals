import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

interface MetricRow {
  label: string;
  value: string;
}

interface RunMetricsTableProps {
  metrics: MetricRow[];
}

export function RunMetricsTable({ metrics }: RunMetricsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-muted-foreground hover:bg-transparent">
          {metrics.map((m) => (
            <TableHead
              key={m.label}
              className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-muted-foreground tracking-[0.08em] bg-background px-3 py-2 uppercase"
            >
              {m.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="border-b border-muted-foreground hover:bg-transparent">
          {metrics.map((m) => (
            <TableCell
              key={m.label}
              className="font-[family-name:var(--font-mono)] text-xs text-foreground/80 bg-background px-3 py-2"
            >
              {m.value}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}
