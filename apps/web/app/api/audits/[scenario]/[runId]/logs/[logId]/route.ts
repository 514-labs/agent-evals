import { NextResponse } from "next/server";

import { readAuditLogChunk } from "@/data/audits";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      scenario: string;
      runId: string;
      logId: string;
    }>;
  },
) {
  const { scenario, runId, logId } = await context.params;
  const { searchParams } = new URL(request.url);
  const start = Number.parseInt(searchParams.get("start") ?? "0", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);

  const chunk = readAuditLogChunk(scenario, runId, logId, Number.isNaN(start) ? 0 : start, Number.isNaN(limit) ? 300 : limit);
  if (!chunk) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  return NextResponse.json(chunk);
}
