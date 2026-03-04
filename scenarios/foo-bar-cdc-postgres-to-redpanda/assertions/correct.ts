import { execSync } from "node:child_process";
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function cdc_row_count_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.orders");
  const sourceCount = Number(pgResult.rows[0]?.n ?? 0);

  const broker = ctx.env("REDPANDA_BROKER") ?? "localhost:9092";
  let topicCount = 0;
  try {
    const out = execSync(
      `python3 -c "
from kafka import KafkaConsumer
c = KafkaConsumer('orders', bootstrap_servers=['${broker}'], auto_offset_reset='earliest', consumer_timeout_ms=3000)
topicCount = sum(1 for _ in c)
c.close()
print(topicCount)
"`,
      { encoding: "utf8", timeout: 5000 },
    );
    topicCount = parseInt(out.trim(), 10) || 0;
  } catch {
    topicCount = 0;
  }

  const passed = topicCount >= sourceCount;
  return {
    passed,
    message: passed
      ? `CDC row count matches: source=${sourceCount}, topic=${topicCount}.`
      : `Source ${sourceCount}, topic ${topicCount}.`,
    details: { sourceCount, topicCount },
  };
}
