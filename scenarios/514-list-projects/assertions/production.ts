import type { AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function no_hardcoded_api_keys(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections({
    literals: ["sk-ant-", "sk-proj-"],
    envTokens: ["process.env", "os.environ", "getenv(", "${"],
  });
}
