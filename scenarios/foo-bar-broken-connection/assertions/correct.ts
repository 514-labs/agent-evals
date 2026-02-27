import type { AssertionContext } from "@dec-bench/eval-core";

export async function five_users_loaded(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.users");
  return Number(result.rows[0]?.n ?? 0) === 5;
}

export async function expected_usernames(ctx: AssertionContext): Promise<boolean> {
  const result = await ctx.pg.query("SELECT username FROM app.users ORDER BY username");
  const names = result.rows.map((r: { username: string }) => r.username);
  const expected = ["alice", "bob", "charlie", "diana", "eve"];
  return JSON.stringify(names) === JSON.stringify(expected);
}
