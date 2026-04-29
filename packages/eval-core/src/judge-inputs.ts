import { readFileSync, statSync, readdirSync, type Dirent } from "node:fs";
import { basename, extname, join, relative } from "node:path";

import type { AssertionContext } from "./context.js";
import type { AssertionLog, GateName } from "./types.js";
import { IGNORED_SCAN_DIRS, IGNORED_SCAN_FILENAMES } from "./workspace-scan.js";

export type JudgeInputName =
  | "sessionLog"
  | "prompt"
  | "workspaceFiles"
  | "assertionOutcomes";

export interface AssertionOutcome {
  name: string;
  gate: GateName;
  category: "core" | "scenario";
  passed: boolean;
  message?: string;
}

export interface JudgeInputBundle {
  assertionOutcomes?: AssertionOutcome[];
  overrides?: Partial<Record<JudgeInputName, string>>;
}

const SESSION_LOG_MAX_BYTES = 64_000;
const PROMPT_MAX_BYTES = 32_000;
const WORKSPACE_FILE_MAX_BYTES = 8_000;
const WORKSPACE_TOTAL_MAX_BYTES = 64_000;
const WORKSPACE_TEXT_EXTENSIONS = new Set([
  ".py", ".js", ".jsx", ".ts", ".tsx", ".sql", ".sh", ".bash", ".zsh",
  ".rb", ".go", ".rs", ".java", ".kt", ".scala", ".yaml", ".yml",
  ".json", ".toml", ".md", ".txt",
]);

export function resolveJudgeInputs(
  ctx: AssertionContext,
  inputs: JudgeInputName[],
  bundle: JudgeInputBundle = {},
): string {
  const sections: string[] = [];

  for (const input of inputs) {
    const override = bundle.overrides?.[input];
    const body = override !== undefined ? override : renderInput(ctx, input, bundle);
    if (body === null) continue;
    sections.push(`## ${input}\n\n${body}`);
  }

  if (sections.length === 0) {
    return "(no inputs were available for this run)";
  }

  return sections.join("\n\n---\n\n");
}

function renderInput(
  ctx: AssertionContext,
  input: JudgeInputName,
  bundle: JudgeInputBundle,
): string | null {
  if (input === "sessionLog") {
    if (!ctx.sessionLogPath) return "(session log path not configured)";
    const text = safeReadTruncated(ctx.sessionLogPath, SESSION_LOG_MAX_BYTES);
    return text ?? "(session log unreadable)";
  }
  if (input === "prompt") {
    if (!ctx.promptPath) return "(prompt path not configured)";
    const text = safeReadTruncated(ctx.promptPath, PROMPT_MAX_BYTES);
    return text ?? "(prompt unreadable)";
  }
  if (input === "workspaceFiles") {
    if (!ctx.workspaceRoot) return "(workspace root not configured)";
    return renderWorkspaceFiles(ctx.workspaceRoot);
  }
  if (input === "assertionOutcomes") {
    return renderAssertionOutcomes(bundle.assertionOutcomes ?? []);
  }
  return null;
}

function safeReadTruncated(path: string, maxBytes: number): string | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    const text = readFileSync(path, "utf8");
    if (text.length <= maxBytes) return text;
    const head = Math.floor(maxBytes * 0.7);
    const tail = maxBytes - head;
    return `${text.slice(0, head)}\n\n[... truncated ${text.length - maxBytes} chars ...]\n\n${text.slice(-tail)}`;
  } catch {
    return null;
  }
}

function renderWorkspaceFiles(root: string): string {
  const files: Array<{ path: string; content: string; lines: number }> = [];
  let totalBytes = 0;

  const visit = (dir: string) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) {
        if (IGNORED_SCAN_DIRS.has(entry.name)) continue;
        visit(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      if (IGNORED_SCAN_FILENAMES.has(entry.name)) continue;
      const ext = extname(entry.name).toLowerCase();
      if (!WORKSPACE_TEXT_EXTENSIONS.has(ext) && entry.name.toLowerCase() !== "dockerfile") {
        continue;
      }
      if (totalBytes >= WORKSPACE_TOTAL_MAX_BYTES) return;
      const filePath = join(dir, entry.name);
      try {
        const stat = statSync(filePath);
        if (stat.size > WORKSPACE_FILE_MAX_BYTES) {
          const partial = readFileSync(filePath, "utf8").slice(0, WORKSPACE_FILE_MAX_BYTES);
          files.push({
            path: relative(root, filePath) || basename(filePath),
            content: `${partial}\n[... truncated ...]`,
            lines: partial.split(/\r?\n/).length,
          });
          totalBytes += partial.length;
        } else {
          const content = readFileSync(filePath, "utf8");
          files.push({
            path: relative(root, filePath) || basename(filePath),
            content,
            lines: content.split(/\r?\n/).length,
          });
          totalBytes += content.length;
        }
      } catch {
        continue;
      }
    }
  };

  try {
    if (!statSync(root).isDirectory()) return "(workspace root is not a directory)";
  } catch {
    return "(workspace root unavailable)";
  }
  visit(root);

  if (files.length === 0) return "(no readable text files found in workspace)";

  const blocks = files.map(
    (file) => `### ${file.path} (${file.lines} lines)\n\`\`\`\n${file.content}\n\`\`\``,
  );
  return blocks.join("\n\n");
}

function renderAssertionOutcomes(outcomes: AssertionOutcome[]): string {
  if (outcomes.length === 0) return "(no assertion outcomes recorded yet)";
  const lines = outcomes.map(
    (outcome) =>
      `- [${outcome.passed ? "PASS" : "FAIL"}] ${outcome.gate}/${outcome.category}/${outcome.name}` +
      (outcome.message ? `: ${outcome.message}` : ""),
  );
  return lines.join("\n");
}

export function flattenAssertionOutcomes(
  logs: Record<GateName, { core: Record<string, AssertionLog>; scenario: Record<string, AssertionLog> }>,
): AssertionOutcome[] {
  const outcomes: AssertionOutcome[] = [];
  for (const gate of Object.keys(logs) as GateName[]) {
    for (const category of ["core", "scenario"] as const) {
      const map = logs[gate][category];
      for (const [name, entry] of Object.entries(map)) {
        outcomes.push({
          name,
          gate,
          category,
          passed: entry.passed,
          message: entry.message,
        });
      }
    }
  }
  return outcomes;
}
