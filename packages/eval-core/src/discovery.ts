import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import type { AssertionContext } from "./context.js";
import type { GateName } from "./types.js";

export type AssertionFn = (ctx: AssertionContext) => Promise<boolean>;

export const GATE_FILES: Record<GateName, string> = {
  functional: "functional.ts",
  correct: "correct.ts",
  robust: "robust.ts",
  performant: "performant.ts",
  production: "production.ts",
};

export async function loadScenarioAssertions(
  assertionsDir: string,
): Promise<Record<GateName, Record<string, AssertionFn>>> {
  const output = {
    functional: {},
    correct: {},
    robust: {},
    performant: {},
    production: {},
  } as Record<GateName, Record<string, AssertionFn>>;

  for (const gate of Object.keys(GATE_FILES) as GateName[]) {
    const filePath = resolve(assertionsDir, GATE_FILES[gate]);
    if (!existsSync(filePath)) {
      continue;
    }

    const mod = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
    const assertions: Record<string, AssertionFn> = {};
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === "function") {
        assertions[name] = value as AssertionFn;
      }
    }
    output[gate] = assertions;
  }

  return output;
}
