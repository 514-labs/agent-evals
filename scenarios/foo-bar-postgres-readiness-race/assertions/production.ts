import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasPostgres = Boolean(ctx.env("POSTGRES_URL"));
  return {
    passed: hasPostgres,
    message: hasPostgres ? "Connection env vars available." : "Missing POSTGRES_URL.",
    details: { hasPostgres },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
