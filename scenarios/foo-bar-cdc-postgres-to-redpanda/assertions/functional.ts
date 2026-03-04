import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function getMessageCount(ctx: AssertionContext): number {
  const broker = ctx.env("REDPANDA_BROKER") ?? "localhost:9092";
  try {
    const out = execSync(
      `python3 -c "
from kafka import KafkaConsumer
c = KafkaConsumer('orders', bootstrap_servers=['${broker}'], auto_offset_reset='earliest', consumer_timeout_ms=3000)
count = sum(1 for _ in c)
c.close()
print(count)
"`,
      { encoding: "utf8", timeout: 5000 },
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export async function orders_topic_has_messages(ctx: AssertionContext): Promise<AssertionResult> {
  const count = getMessageCount(ctx);
  const passed = count >= 10;
  return {
    passed,
    message: passed ? `Orders topic has ${count} messages.` : `Expected >=10 messages, got ${count}.`,
    details: { count },
  };
}
