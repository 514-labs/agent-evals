import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasReadmeOrDocs, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function langfuse_keys_from_env_vars(ctx: AssertionContext): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections({
    literals: [
      "pk-lf-",
      "sk-lf-",
      "cloud.langfuse.com",
      "localhost:8123",
      "localhost:9000",
    ],
    envTokens: [
      "process.env",
      "ctx.env(",
      "os.environ",
      "getenv(",
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
      "LANGFUSE_HOST",
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
