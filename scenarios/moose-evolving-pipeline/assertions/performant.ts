import type { AssertionResult } from "@dec-bench/eval-core";

async function medianLatency(url: string, runs: number = 3): Promise<number> {
  const timings: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    await fetch(url, { signal: AbortSignal.timeout(5000) });
    timings.push(Date.now() - start);
  }
  timings.sort((a, b) => a - b);
  return timings[Math.floor(timings.length / 2)];
}

async function findApiPort(): Promise<number | null> {
  for (const port of [3000, 4000, 8080]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/top-products`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return port;
    } catch {}
  }
  return null;
}

export async function top_products_under_200ms(): Promise<AssertionResult> {
  const port = await findApiPort();
  if (!port) {
    return { passed: false, message: "API server not reachable.", details: {} };
  }
  const median = await medianLatency(`http://localhost:${port}/api/top-products`);
  const passed = median < 200;
  return {
    passed,
    message: passed ? `Top products median ${median}ms (< 200ms).` : `Top products median ${median}ms (>= 200ms).`,
    details: { medianMs: median, port },
  };
}

export async function revenue_by_region_under_200ms(): Promise<AssertionResult> {
  const port = await findApiPort();
  if (!port) {
    return { passed: false, message: "API server not reachable.", details: {} };
  }
  const median = await medianLatency(`http://localhost:${port}/api/revenue-by-region`);
  const passed = median < 200;
  return {
    passed,
    message: passed ? `Revenue by region median ${median}ms (< 200ms).` : `Revenue by region median ${median}ms (>= 200ms).`,
    details: { medianMs: median, port },
  };
}
