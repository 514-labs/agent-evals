import type { AssertionResult } from "@dec-bench/eval-core";
import { execSync } from "node:child_process";

export async function topic_has_multiple_partitions(): Promise<AssertionResult> {
  try {
    const broker = process.env.REDPANDA_BROKER ?? "localhost:9092";
    const output = execSync(
      `rpk topic describe orders --brokers ${broker}`,
      { encoding: "utf8", timeout: 10000 },
    );
    // rpk output has one numbered row per partition: "0  leader  ..."
    const partitionLines = output.split("\n").filter((l) => /^\s*\d+\s/.test(l));
    const partitionCount = partitionLines.length;
    const passed = partitionCount >= 2;
    return {
      passed,
      message: passed
        ? `Topic has ${partitionCount} partitions.`
        : `Topic has ${partitionCount} partition (needs ≥2).`,
      details: { partitionCount },
    };
  } catch (e: any) {
    return {
      passed: false,
      message: `Could not describe topic: ${e.message?.slice(0, 200)}`,
      details: {},
    };
  }
}
