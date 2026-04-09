import "server-only";

import { cache } from "react";

import {
  loadResults,
  deriveLeaderboardEntries,
  deriveUniqueScenarios,
  deriveUniqueHarnesses,
  deriveUniqueModels,
  deriveUniquePersonas,
} from "./results-core";

export type {
  GateResult,
  GateName,
  EvalResult,
  LeaderboardEntry,
} from "./results-core";

const getCachedResults = cache(loadResults);

export function getLeaderboardEntries() {
  return deriveLeaderboardEntries(getCachedResults());
}

export function getUniqueScenarios() {
  return deriveUniqueScenarios(getCachedResults());
}

export function getUniqueHarnesses() {
  return deriveUniqueHarnesses(getCachedResults());
}

export function getUniqueModels() {
  return deriveUniqueModels(getCachedResults());
}

export function getUniquePersonas() {
  return deriveUniquePersonas(getCachedResults());
}
