import type { BaselineMetrics, ObservedMetrics, ReferenceMetrics } from "@rad-bench/scenarios";

/**
 * Latency improvement ratio: how much the agent improved query latency
 * relative to the gap between baseline and reference.
 *
 * Returns 1.0 if the agent matches the reference, 0.0 if no improvement.
 * Clamped to [0, 1].
 */
export function latencyImprovementRatio(
  baseline: BaselineMetrics,
  reference: ReferenceMetrics,
  observed: ObservedMetrics,
): number {
  const gap = baseline.queryLatencyMs - reference.queryLatencyMs;
  if (gap <= 0) return 1.0; // baseline already at reference
  const improvement = baseline.queryLatencyMs - observed.queryLatencyMs;
  return Math.max(0, Math.min(1, improvement / gap));
}

/**
 * Cost improvement ratio: how much the agent improved cost per query
 * relative to the gap between baseline and reference.
 *
 * Returns 1.0 if the agent matches the reference, 0.0 if no improvement.
 * Clamped to [0, 1].
 */
export function costImprovementRatio(
  baseline: BaselineMetrics,
  reference: ReferenceMetrics,
  observed: ObservedMetrics,
): number {
  const gap = baseline.costPerQueryUsd - reference.costPerQueryUsd;
  if (gap <= 0) return 1.0;
  const improvement = baseline.costPerQueryUsd - observed.costPerQueryUsd;
  return Math.max(0, Math.min(1, improvement / gap));
}

/**
 * Storage improvement ratio: how much the agent reduced storage
 * relative to the gap between baseline and reference.
 *
 * Returns 1.0 if the agent matches the reference, 0.0 if no improvement.
 * Clamped to [0, 1].
 */
export function storageImprovementRatio(
  baseline: BaselineMetrics,
  reference: ReferenceMetrics,
  observed: ObservedMetrics,
): number {
  const gap = baseline.storageBytes - reference.storageBytes;
  if (gap <= 0) return 1.0;
  const improvement = baseline.storageBytes - observed.storageBytes;
  return Math.max(0, Math.min(1, improvement / gap));
}

/**
 * Task completion ratio: fraction of tasks successfully completed.
 */
export function taskCompletionRatio(observed: ObservedMetrics): number {
  if (observed.totalTasks === 0) return 0;
  return Math.max(0, Math.min(1, observed.tasksCompleted / observed.totalTasks));
}
