// Shared scan-ignore policy for workspace walkers — used both by the
// gate runner in this package and by scenario-level assertion helpers in
// `scenarios/_shared`. Keep the two in sync by importing from here.

// Directory names skipped when walking the agent workspace: VCS metadata,
// build/test output, language-specific caches, and platform scaffolding
// (`.moose/` holds moose dev's generated TypeScript + infra maps, which
// aren't agent-authored code).
export const IGNORED_SCAN_DIRS: ReadonlySet<string> = new Set([
  ".git",
  ".next",
  ".turbo",
  ".moose",
  "dist",
  "build",
  "coverage",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
]);

// Filenames skipped when walking the workspace: auto-generated lockfiles
// and scaffolded platform configs that carry fixture credentials. Scoring
// agents on artifacts they didn't write makes scores harness-dependent.
export const IGNORED_SCAN_FILENAMES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "moose.config.toml",
]);
