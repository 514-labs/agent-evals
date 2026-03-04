import { NextResponse } from "next/server";

import { getAuditRunTrace } from "@/data/audits";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      scenario: string;
      runId: string;
    }>;
  },
) {
  const { scenario, runId } = await context.params;
  const trace = getAuditRunTrace(scenario, runId);
  if (!trace) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }

  return NextResponse.json(trace);
}
