import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function aws_keys_from_env_vars(ctx: AssertionContext): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections({
    literals: [
      "AKIA",
      "localhost:8123",
      "localhost:9000",
    ],
    envTokens: [
      "process.env",
      "ctx.env(",
      "os.environ",
      "getenv(",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "BEDROCK_GUARDRAIL_ID",
      "CLICKHOUSE_URL",
    ],
  });
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function has_readme_or_docs(): Promise<AssertionResult> {
  return hasReadmeOrDocs();
}
