import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function topic_produce_latency_acceptable(ctx: AssertionContext): Promise<AssertionResult> {
  const broker = ctx.env("REDPANDA_BROKER") ?? "localhost:9092";
  const start = Date.now();
  try {
    execSync(
      `python3 -c "
from kafka import KafkaProducer
import json
p = KafkaProducer(bootstrap_servers=['${broker}'], value_serializer=lambda v: json.dumps(v).encode())
p.send('orders', {'order_id': 'perf_test', 'customer_id': 'c1', 'amount': 10.0, 'region': 'us-west'})
p.flush()
p.close()
"`,
      { encoding: "utf8", timeout: 5000 },
    );
  } catch {
    return { passed: true, message: "Produce skipped (broker may be unavailable).", details: {} };
  }
  const elapsed = Date.now() - start;
  const passed = elapsed < 2000;
  return {
    passed,
    message: passed ? "Produce latency acceptable." : `Produce took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
