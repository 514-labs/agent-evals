import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function listTopics(ctx: AssertionContext): string[] {
  const broker = ctx.env("REDPANDA_BROKER") ?? "localhost:9092";
  try {
    const out = execSync(
      `python3 -c "
from kafka import KafkaAdminClient
c = KafkaAdminClient(bootstrap_servers=['${broker}'])
print('\\n'.join(c.list_topics()))
"`,
      { encoding: "utf8" },
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function orders_topic_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const topics = listTopics(ctx);
  const hasOrders = topics.some((t) => t === "orders");
  return {
    passed: hasOrders,
    message: hasOrders ? "Orders topic exists." : `Expected topic 'orders', got: ${topics.join(", ") || "none"}.`,
    details: { topics },
  };
}
