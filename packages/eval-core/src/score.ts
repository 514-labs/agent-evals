import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@dec-bench/scenarios";
import {
  costImprovementRatio,
  latencyImprovementRatio,
  storageImprovementRatio,
  taskCompletionRatio,
} from "./metrics.js";

/**
 * Scoring weights (§7.1 of spec).
 * Weights sum to 1.0.
 */
export interface ScoreWeights {
  /** Weight for task completion (correctness) */
  taskCompletion: number;
  /** Weight for query latency improvement */
  latency: number;
  /** Weight for cost per query improvement */
  cost: number;
  /** Weight for storage reduction */
  storage: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  taskCompletion: 0.40,
  latency: 0.30,
  cost: 0.20,
  storage: 0.10,
};

export interface ScoreBreakdown {
  /** Final composite score in [0, 1] */
  total: number;
  /** Component scores before weighting */
  components: {
    taskCompletion: number;
    latency: number;
    cost: number;
    storage: number;
  };
  /** Weights applied */
  weights: ScoreWeights;
}

/**
 * Compute the composite DEC Bench score for a single eval run.
 *
 * Formula (§7.1):
 *   score = w_task * task_completion
 *         + w_latency * latency_improvement
 *         + w_cost * cost_improvement
 *         + w_storage * storage_improvement
 *
 * All component scores are in [0, 1]; the composite is also in [0, 1].
 */
export function computeScore(
  baseline: BaselineMetrics,
  reference: ReferenceMetrics,
  observed: ObservedMetrics,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const components = {
    taskCompletion: taskCompletionRatio(observed),
    latency: latencyImprovementRatio(baseline, reference, observed),
    cost: costImprovementRatio(baseline, reference, observed),
    storage: storageImprovementRatio(baseline, reference, observed),
  };

  const total =
    weights.taskCompletion * components.taskCompletion +
    weights.latency * components.latency +
    weights.cost * components.cost +
    weights.storage * components.storage;

  return {
    total: Math.max(0, Math.min(1, total)),
    components,
    weights,
  };
}

/**
 * Format a score as a percentage string.
 */
export function formatScore(score: number, decimals = 1): string {
  return `${(score * 100).toFixed(decimals)}%`;
}
