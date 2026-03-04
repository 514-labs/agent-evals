import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function five_users_loaded(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.users");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 5;
  return {
    passed,
    message: passed ? "Five users loaded." : `Expected 5 users, got ${count}.`,
    details: { count },
  };
}

export async function expected_usernames(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT username FROM app.users ORDER BY username");
  const names = result.rows.map((r: { username: string }) => r.username);
  const expected = ["alice", "bob", "charlie", "diana", "eve"];
  const passed = JSON.stringify(names) === JSON.stringify(expected);
  return {
    passed,
    message: passed ? "Expected usernames present." : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(names)}.`,
    details: { names },
  };
}
