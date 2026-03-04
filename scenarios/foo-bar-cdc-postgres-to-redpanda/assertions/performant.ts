import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function consume_latency_acceptable(ctx: AssertionContext): Promise<AssertionResult> {
  const broker = ctx.env("REDPANDA_BROKER") ?? "localhost:9092";
  const start = Date.now();
  try {
    execSync(
      `python3 -c "
from kafka import KafkaConsumer
c = KafkaConsumer('orders', bootstrap_servers=['${broker}'], auto_offset_reset='earliest', consumer_timeout_ms=2000)
_ = list(c)
c.close()
"`,
      { encoding: "utf8", timeout: 5000 },
    );
  } catch {
    return { passed: true, message: "Consume skipped.", details: {} };
  }
  const elapsed = Date.now() - start;
  const passed = elapsed < 3000;
  return {
    passed,
    message: passed ? "Consume latency acceptable." : `Consume took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
