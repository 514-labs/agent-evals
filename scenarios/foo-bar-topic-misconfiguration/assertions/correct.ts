import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync, existsSync } from "node:fs";

export async function topic_config_documents_partitions(): Promise<AssertionResult> {
  const path = "/workspace/topic-config.md";
  if (!existsSync(path)) {
    return { passed: false, message: "topic-config.md does not exist.", details: {} };
  }
  const content = readFileSync(path, "utf8");
  const hasPartitions = /partition[s]?\s*[=:]\s*[2-9]|\d+\s*partition/i.test(content);
  return {
    passed: hasPartitions,
    message: hasPartitions ? "Topic config documents multiple partitions." : "Topic config does not show increased partitions.",
    details: { hasPartitions },
  };
}
