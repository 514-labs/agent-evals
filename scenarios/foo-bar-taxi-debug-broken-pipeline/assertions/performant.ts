import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function api_responds_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const start = Date.now();
    const resp = await fetch("http://localhost:3000/trips?limit=50");
    await resp.json();
    const elapsed = Date.now() - start;

    if (!resp.ok) {
      return { passed: false, message: `API returned HTTP ${resp.status}.`, details: { status: resp.status } };
    }

    const passed = elapsed < 500;
    return {
      passed,
      message: passed
        ? `API /trips responded in ${elapsed}ms (< 500ms).`
        : `API /trips took ${elapsed}ms (expected < 500ms).`,
      details: { elapsedMs: elapsed },
    };
  } catch (err) {
    return { passed: false, message: `API request failed: ${String(err)}`, details: {} };
  }
}
