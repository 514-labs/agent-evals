import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { execSync } from "node:child_process";

export async function topic_has_multiple_partitions(): Promise<AssertionResult> {
  try {
    const broker = process.env.REDPANDA_BROKER ?? "localhost:9092";
    const output = execSync(
      `rpk topic describe orders --brokers ${broker} 2>/dev/null || kafka-topics.sh --describe --topic orders --bootstrap-server ${broker} 2>/dev/null`,
      { encoding: "utf8", timeout: 10000 },
    );
    const partitionMatch = output.match(/partition[_\s-]*count[:\s]*(\d+)/i)
      ?? output.match(/(\d+)\s*partition/i);
    const partitionCount = partitionMatch ? Number(partitionMatch[1]) : 0;

    // If rpk/kafka-topics didn't give structured output, count PARTITION lines
    if (partitionCount === 0) {
      const lines = output.split("\n").filter((l) => /^\s*\d+\s/.test(l) || /PARTITION/i.test(l));
      const passed = lines.length >= 2;
      return {
        passed,
        message: passed
          ? `Topic appears to have ${lines.length} partitions.`
          : "Could not confirm multiple partitions from topic description.",
        details: { lineCount: lines.length, outputPreview: output.slice(0, 300) },
      };
    }

    const passed = partitionCount >= 2;
    return {
      passed,
      message: passed
        ? `Topic has ${partitionCount} partitions.`
        : `Topic still has ${partitionCount} partition (needs ≥2).`,
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
