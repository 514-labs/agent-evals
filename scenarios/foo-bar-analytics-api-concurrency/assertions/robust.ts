import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function handles_concurrent_requests(ctx: AssertionContext): Promise<AssertionResult> {
  const concurrency = 5;
  const promises = Array.from({ length: concurrency }, () =>
    fetch("http://localhost:3000/api/metrics").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Status ${r.status}`)))),
  );
  const results = await Promise.allSettled(promises);
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const passed = fulfilled >= concurrency;
  return {
    passed,
    message: passed ? "Handles concurrent requests." : `${fulfilled}/${concurrency} concurrent requests succeeded.`,
    details: { fulfilled, total: concurrency },
  };
}
