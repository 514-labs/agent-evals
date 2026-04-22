import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function clickhouse_url_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasUrl = Boolean(ctx.env("CLICKHOUSE_URL"));
  return {
    passed: hasUrl,
    message: hasUrl ? "CLICKHOUSE_URL is set." : "CLICKHOUSE_URL env var missing.",
    details: { hasUrl },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
