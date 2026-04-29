import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";

import type { AssertionFn } from "./discovery.js";
import { llmJudge, type JudgeToolName } from "./judge.js";
import type { JudgeInputName, AssertionOutcome } from "./judge-inputs.js";

export interface MetaJudgeManifest {
  id: string;
  title?: string;
  description?: string;
  inputs: JudgeInputName[];
  tools?: JudgeToolName[];
  model?: string;
  samples?: number;
  maxTurns?: number;
  advisory?: boolean;
}

export interface LoadedMetaJudge {
  id: string;
  manifest: MetaJudgeManifest;
  fn: (outcomes: AssertionOutcome[]) => AssertionFn;
}

export function discoverMetaJudges(rootDir: string): LoadedMetaJudge[] {
  if (!existsSync(rootDir)) return [];
  let entries: Dirent[];
  try {
    entries = readdirSync(rootDir, { withFileTypes: true }) as Dirent[];
  } catch {
    return [];
  }

  const judges: LoadedMetaJudge[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(rootDir, entry.name);
    const manifestPath = join(dir, "meta-judge.json");
    const rubricPath = join(dir, "rubric.md");
    if (!existsSync(manifestPath) || !existsSync(rubricPath)) continue;

    let manifest: MetaJudgeManifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MetaJudgeManifest;
    } catch {
      continue;
    }
    const rubric = readFileSync(rubricPath, "utf8");
    const id = manifest.id || entry.name;

    judges.push({
      id,
      manifest,
      fn: (outcomes: AssertionOutcome[]) =>
        llmJudge({
          rubric,
          inputs: manifest.inputs,
          tools: manifest.tools,
          model: manifest.model,
          samples: manifest.samples,
          maxTurns: manifest.maxTurns,
          inputBundle: () => ({ assertionOutcomes: outcomes }),
        }),
    });
  }

  return judges;
}

export interface MetaJudgeFilter {
  scenarioOptOut?: Record<string, boolean>;
  globalDisable?: boolean;
}

export function applyMetaJudgeFilter(
  judges: LoadedMetaJudge[],
  filter: MetaJudgeFilter,
): LoadedMetaJudge[] {
  if (filter.globalDisable) return [];
  if (!filter.scenarioOptOut) return judges;
  return judges.filter((judge) => filter.scenarioOptOut?.[judge.id] !== false);
}

export function defaultMetaJudgesDir(workspaceRoot: string): string {
  const candidate = join(workspaceRoot, "meta-judges");
  try {
    if (statSync(candidate).isDirectory()) return candidate;
  } catch {
    // fall through
  }
  return candidate;
}
