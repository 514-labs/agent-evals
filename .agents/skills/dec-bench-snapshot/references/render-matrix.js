// Render the AXP comparison matrix in the canonical snapshot format.
//
// Usage:
//   node render-matrix.js [resultsDir]
//
// Defaults to ./results. Picks the most recent run per (scenario, harness,
// persona) cell within a per-scenario "latest code" cutoff (edit the
// LATEST_CUTOFF map below for new snapshots).
//
// Output: Unicode-bordered table with two-line wrapped headers, sized to
// fit canonical content widths. Numeric columns right-aligned. Scenarios
// separated by horizontal rule.

const fs = require("fs");
const path = require("path");

// ---- config ----
const RESULTS_DIR = process.argv[2] || path.resolve(__dirname, "../../../../results");
const SCENARIOS = [
  "foo-bar-mv-access-patterns",
  "foo-bar-create-analytics-table",
  "foo-bar-csv-ingest",
  "foo-bar-ingest-to-api",
  "foo-bar-full-olap-pipeline",
];
const HARNESSES = ["base-rt", "olap-for-swe", "tinybird-forward"];
const PERSONAS = ["baseline", "informed"];

// Per-scenario unix-millis cutoff. Runs older than this are excluded
// (assertion code differed). Update when assertion code lands.
const LATEST_CUTOFF = {
  "foo-bar-mv-access-patterns": 1776974000000,
  "foo-bar-create-analytics-table": 1776990000000,
  "foo-bar-csv-ingest": 1776990000000,
  "foo-bar-ingest-to-api": 1777055000000,
  "foo-bar-full-olap-pipeline": 1777055000000,
};

const AGENT = "claude-code";
const MODEL = "claude-sonnet-4-6";

// ---- aggregation ----
const byCell = {};
for (const f of fs.readdirSync(RESULTS_DIR)) {
  if (!f.endsWith(".json")) continue;
  if (f.includes("assertion-log") || f.includes("service-logs") || f.includes("run-meta") || f.includes("agent-raw") || f.includes("trace")) continue;
  const m = f.match(/^(foo-bar-[a-z-]+?)-(claude-code)-(claude-sonnet-4-6)-(base-rt|olap-for-swe|tinybird-forward)-(baseline|informed)-(no-plan|plan)-(\d+)\.json$/);
  if (!m) continue;
  const [, scenario, agent, model, harness, persona, , ts] = m;
  if (!SCENARIOS.includes(scenario)) continue;
  if (agent !== AGENT || model !== MODEL) continue;
  if (Number(ts) < (LATEST_CUTOFF[scenario] ?? 0)) continue;
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), "utf8")); } catch { continue; }
  if (!d.efficiency) continue;

  // Detect tools used by grepping session.jsonl
  const sess = path.join(RESULTS_DIR, f.replace(".json", ".session.jsonl"));
  let tool = "?";
  try {
    const txt = fs.readFileSync(sess, "utf8");
    const used = [];
    if (/\btb --local\b|docker start tb-local/.test(txt)) used.push("tb");
    if (/\bmoose (init|dev|build)\b/.test(txt)) used.push("moose");
    if (/clickhouse-client/.test(txt)) used.push("ch-cli");
    tool = used.join("+") || "none";
  } catch {}

  const key = `${scenario}|${harness}|${persona}`;
  const row = {
    scenario, harness, persona,
    score: d.normalized_score,
    gate: d.highest_gate,
    wall: d.efficiency.wallClockSeconds,
    cost: d.efficiency.llmApiCostUsd,
    tokens: d.efficiency.tokensUsed,
    tool, ts: Number(ts),
  };
  if (!byCell[key] || byCell[key].ts < row.ts) byCell[key] = row;
}

// ---- render ----
const W = [24, 18, 10, 7, 6, 7, 9, 8, 14, 7];
const HEAD = [
  ["scenario", ""],
  ["harness", ""],
  ["person", "a"],
  ["scor", "e"],
  ["gat", "e"],
  ["wall", ""],
  ["cost", ""],
  ["token", "s"],
  ["tools", "used"],
  ["date", ""],
];
const center = (s, w) => { const p = w - s.length; const l = Math.floor(p / 2); return " ".repeat(l) + s + " ".repeat(p - l); };
const padR = (s, w) => " " + s.slice(0, w-2).padEnd(w-2) + " ";
const padL = (s, w) => " " + s.slice(0, w-2).padStart(w-2) + " ";
const line = (l, m, r) => l + W.map(w => "─".repeat(w)).join(m) + r;
const headerRow = (idx) => "│" + HEAD.map((h, i) => center(h[idx] || "", W[i])).join("│") + "│";
const ALIGN_R = new Set([3, 4, 5, 6, 7]);

console.log(line("┌", "┬", "┐"));
console.log(headerRow(0));
console.log(headerRow(1));
console.log(line("├", "┼", "┤"));

let lastScenario = "";
for (const s of SCENARIOS) {
  for (const h of HARNESSES) {
    for (const p of PERSONAS) {
      const r = byCell[`${s}|${h}|${p}`];
      if (lastScenario && lastScenario !== s) console.log(line("├", "┼", "┤"));
      lastScenario = s;
      const sName = s.replace(/^foo-bar-/, "");
      let cells;
      if (!r) cells = [sName, h, p, "—", "—", "—", "—", "—", "—", "—"];
      else {
        const wallStr = r.wall > 10000 ? "~bad" : (r.wall + "s");
        const dt = new Date(r.ts).toISOString().slice(5, 10);
        cells = [sName, h, p, r.score.toFixed(3), String(r.gate), wallStr, "$" + r.cost.toFixed(4), String(r.tokens), r.tool, dt];
      }
      console.log("│" + cells.map((v, i) => ALIGN_R.has(i) ? padL(String(v), W[i]) : padR(String(v), W[i])).join("│") + "│");
    }
  }
}
console.log(line("└", "┴", "┘"));
