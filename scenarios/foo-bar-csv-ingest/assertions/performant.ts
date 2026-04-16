import type { AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
