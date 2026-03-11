use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use anyhow::{bail, Context, Result};
use clap::Args;
use serde::{Deserialize, Serialize};

const SIDECAR_SUFFIXES: [&str; 8] = [
    ".agent-raw.json",
    ".trace.json",
    ".assertion-log.json",
    ".run-meta.json",
    ".session.jsonl",
    ".infra.stdout",
    ".stdout",
    ".stderr",
];

#[derive(Args)]
pub struct ResultsArgs {
    /// Filter results by scenario ID
    #[arg(short, long)]
    pub scenario: Option<String>,

    /// Show only the newest matching run
    #[arg(long)]
    pub latest: bool,

    /// Show a specific run by run ID
    #[arg(long = "run-id")]
    pub run_id: Option<String>,

    /// Results directory (default: ./results)
    #[arg(long, default_value = "results")]
    pub dir: String,

    /// Output format
    #[arg(long, value_enum, default_value = "table")]
    pub format: OutputFormat,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum OutputFormat {
    Table,
    Json,
    Csv,
}

#[derive(Debug, Clone, Serialize)]
struct ArtifactPaths {
    stdout: Option<String>,
    infra_stdout: Option<String>,
    stderr: Option<String>,
    trace: Option<String>,
    assertion_log: Option<String>,
    session_jsonl: Option<String>,
    run_meta: Option<String>,
    agent_raw: Option<String>,
}

#[derive(Debug, Clone)]
struct ResultEntry {
    file_path: PathBuf,
    file_name: String,
    run_id: String,
    sort_key: u64,
    result: ResultPayload,
    artifacts: ArtifactPaths,
    raw_value: serde_json::Value,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ResultPayload {
    run_id: Option<String>,
    scenario: Option<String>,
    harness: Option<String>,
    agent: Option<String>,
    model: Option<String>,
    version: Option<String>,
    highest_gate: Option<u8>,
    normalized_score: Option<f64>,
    created_at: Option<String>,
}

pub async fn execute(args: ResultsArgs) -> Result<()> {
    let dir = PathBuf::from(&args.dir);
    if !dir.exists() {
        println!("No results directory found at {}.", dir.display());
        return Ok(());
    }

    let mut results = load_results(&dir)?;
    if let Some(scenario) = &args.scenario {
        results.retain(|entry| entry.result.scenario.as_deref() == Some(scenario.as_str()));
    }
    if let Some(run_id) = &args.run_id {
        results.retain(|entry| entry.run_id == *run_id);
        if results.is_empty() {
            bail!("No result run found for run_id '{}'", run_id);
        }
    }

    let detail = if args.latest {
        results.first().cloned()
    } else if args.run_id.is_some() {
        results.first().cloned()
    } else {
        None
    };

    match args.format {
        OutputFormat::Table => {
            if let Some(entry) = detail.as_ref() {
                print_detail_table(entry);
            } else {
                print_table(&results);
            }
        }
        OutputFormat::Json => {
            if let Some(entry) = detail.as_ref() {
                print_detail_json(entry)?;
            } else {
                print_json(&results)?;
            }
        }
        OutputFormat::Csv => {
            if let Some(entry) = detail.as_ref() {
                print_csv(std::slice::from_ref(entry));
            } else {
                print_csv(&results);
            }
        }
    }

    Ok(())
}

fn load_results(dir: &Path) -> Result<Vec<ResultEntry>> {
    let mut stack = vec![dir.to_path_buf()];
    let mut best_by_base: BTreeMap<String, (u8, ResultEntry)> = BTreeMap::new();

    while let Some(current) = stack.pop() {
        for entry in
            fs::read_dir(&current).with_context(|| format!("Failed to read {}", current.display()))?
        {
            let entry = entry?;
            let path = entry.path();
            if entry.file_type()?.is_dir() {
                if entry.file_name() == "audits" {
                    continue;
                }
                stack.push(path);
                continue;
            }
            if !entry.file_type()?.is_file() {
                continue;
            }
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !is_result_candidate(&file_name) {
                continue;
            }

            let raw = fs::read_to_string(&path)
                .with_context(|| format!("Failed to read {}", path.display()))?;
            let raw_value = extract_result_json(&raw)
                .with_context(|| format!("Invalid result JSON in {}", path.display()))?;
            let payload: ResultPayload =
                serde_json::from_value(raw_value.clone()).unwrap_or_default();
            let run_id = payload
                .run_id
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| canonical_result_base(&file_name));

            let result = ResultEntry {
                file_name: file_name.clone(),
                file_path: path.clone(),
                run_id,
                sort_key: result_sort_key(&path, &file_name),
                artifacts: collect_artifacts(&path),
                result: payload,
                raw_value,
            };

            let dedupe_key = format!(
                "{}:{}",
                path.parent()
                    .map(|parent| parent.display().to_string())
                    .unwrap_or_default(),
                canonical_result_base(&file_name)
            );
            let priority = candidate_priority(&file_name);
            match best_by_base.get(&dedupe_key) {
                Some((existing_priority, _)) if *existing_priority >= priority => {}
                _ => {
                    best_by_base.insert(dedupe_key, (priority, result));
                }
            }
        }
    }

    let mut output: Vec<_> = best_by_base.into_values().map(|(_, entry)| entry).collect();
    output.sort_by(|a, b| {
        b.sort_key
            .cmp(&a.sort_key)
            .then_with(|| a.file_name.cmp(&b.file_name))
    });
    Ok(output)
}

fn is_result_candidate(name: &str) -> bool {
    if SIDECAR_SUFFIXES.iter().any(|suffix| name.ends_with(suffix)) {
        return false;
    }
    name.ends_with(".json")
        || name.ends_with(".stdout.log")
        || (name.ends_with(".log") && name.contains("-run") && !name.ends_with(".stderr.log"))
}

fn candidate_priority(name: &str) -> u8 {
    if name.ends_with(".json") { 2 } else { 1 }
}

fn canonical_result_base(file_name: &str) -> String {
    file_name
        .trim_end_matches(".stdout.log")
        .trim_end_matches(".stderr.log")
        .trim_end_matches(".json")
        .trim_end_matches(".log")
        .to_string()
}

fn extract_result_json(raw: &str) -> Result<serde_json::Value> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        bail!("Empty result file");
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        return Ok(value);
    }

    for line in trimmed.lines().rev() {
        let line = line.trim();
        if line.is_empty() || !line.ends_with('}') {
            continue;
        }
        let Some(start) = line.find('{') else {
            continue;
        };
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line[start..]) {
            return Ok(value);
        }
    }

    bail!("No parseable result JSON found")
}

fn result_sort_key(path: &Path, file_name: &str) -> u64 {
    timestamp_suffix(&canonical_result_base(file_name))
        .or_else(|| {
            fs::metadata(path)
                .ok()
                .and_then(|meta| meta.modified().ok())
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs())
        })
        .unwrap_or(0)
}

fn timestamp_suffix(base: &str) -> Option<u64> {
    let digits = base
        .chars()
        .rev()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    if digits.len() >= 10 {
        digits.parse::<u64>().ok()
    } else {
        None
    }
}

fn collect_artifacts(result_path: &Path) -> ArtifactPaths {
    let dir = result_path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = result_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    let base = canonical_result_base(&file_name);

    ArtifactPaths {
        stdout: first_existing_path(
            dir,
            &[
                file_name.clone(),
                format!("{base}.stdout"),
                format!("{base}.stdout.log"),
            ],
            |name| name.ends_with(".stdout") || name.ends_with(".stdout.log"),
        ),
        infra_stdout: first_existing_path(
            dir,
            &[format!("{base}.infra.stdout"), format!("{base}.infra.stdout.log")],
            |_| true,
        ),
        stderr: first_existing_path(
            dir,
            &[format!("{base}.stderr"), format!("{base}.stderr.log")],
            |_| true,
        ),
        trace: first_existing_path(dir, &[format!("{base}.trace.json")], |_| true),
        assertion_log: first_existing_path(dir, &[format!("{base}.assertion-log.json")], |_| true),
        session_jsonl: first_existing_path(dir, &[format!("{base}.session.jsonl")], |_| true),
        run_meta: first_existing_path(dir, &[format!("{base}.run-meta.json")], |_| true),
        agent_raw: first_existing_path(dir, &[format!("{base}.agent-raw.json")], |_| true),
    }
}

fn first_existing_path<F>(dir: &Path, candidates: &[String], allow: F) -> Option<String>
where
    F: Fn(&str) -> bool,
{
    for candidate in candidates {
        if !allow(candidate) {
            continue;
        }
        let path = dir.join(candidate);
        if path.exists() {
            return Some(path.display().to_string());
        }
    }
    None
}

fn print_table(entries: &[ResultEntry]) {
    if entries.is_empty() {
        println!("No result files found.");
        return;
    }

    println!(
        "{:<28} {:<22} {:<12} {:<14} {:<26} {:<6} {:<8} {}",
        "RUN_ID", "SCENARIO", "HARNESS", "AGENT", "MODEL", "GATE", "SCORE", "FILE"
    );
    println!("{}", "-".repeat(160));

    for entry in entries {
        println!(
            "{:<28} {:<22} {:<12} {:<14} {:<26} {:<6} {:<8} {}",
            entry.run_id,
            entry.result.scenario.as_deref().unwrap_or("-"),
            entry.result.harness.as_deref().unwrap_or("-"),
            entry.result.agent.as_deref().unwrap_or("-"),
            entry.result.model.as_deref().unwrap_or("-"),
            entry.result.highest_gate.map(|v| v.to_string()).unwrap_or_else(|| "-".to_string()),
            entry.result.normalized_score.map(|v| format!("{v:.2}")).unwrap_or_else(|| "-".to_string()),
            entry.file_name
        );
    }
}

fn print_detail_table(entry: &ResultEntry) {
    println!("Run ID: {}", entry.run_id);
    println!("Scenario: {}", entry.result.scenario.as_deref().unwrap_or("-"));
    println!("Harness: {}", entry.result.harness.as_deref().unwrap_or("-"));
    println!("Agent: {}", entry.result.agent.as_deref().unwrap_or("-"));
    println!("Model: {}", entry.result.model.as_deref().unwrap_or("-"));
    println!("Version: {}", entry.result.version.as_deref().unwrap_or("-"));
    println!(
        "Highest gate: {}",
        entry.result.highest_gate.map(|v| v.to_string()).unwrap_or_else(|| "-".to_string())
    );
    println!(
        "Normalized score: {}",
        entry.result
            .normalized_score
            .map(|v| format!("{v:.4}"))
            .unwrap_or_else(|| "-".to_string())
    );
    if let Some(created_at) = &entry.result.created_at {
        println!("Created at: {}", created_at);
    }
    println!("Result file: {}", entry.file_path.display());
    println!("Artifacts:");
    print_artifact("stdout", entry.artifacts.stdout.as_deref());
    print_artifact("infra stdout", entry.artifacts.infra_stdout.as_deref());
    print_artifact("stderr", entry.artifacts.stderr.as_deref());
    print_artifact("trace", entry.artifacts.trace.as_deref());
    print_artifact("assertion log", entry.artifacts.assertion_log.as_deref());
    print_artifact("session jsonl", entry.artifacts.session_jsonl.as_deref());
    print_artifact("run metadata", entry.artifacts.run_meta.as_deref());
    print_artifact("agent raw", entry.artifacts.agent_raw.as_deref());
}

fn print_artifact(label: &str, value: Option<&str>) {
    println!("  {}: {}", label, value.unwrap_or("-"));
}

fn print_json(entries: &[ResultEntry]) -> Result<()> {
    let payload: Vec<_> = entries.iter().map(summary_json).collect();
    println!("{}", serde_json::to_string_pretty(&payload)?);
    Ok(())
}

fn print_detail_json(entry: &ResultEntry) -> Result<()> {
    let payload = serde_json::json!({
        "run_id": entry.run_id,
        "file": entry.file_path,
        "summary": summary_json(entry),
        "artifacts": entry.artifacts,
        "raw_result": entry.raw_value,
    });
    println!("{}", serde_json::to_string_pretty(&payload)?);
    Ok(())
}

fn summary_json(entry: &ResultEntry) -> serde_json::Value {
    serde_json::json!({
        "run_id": entry.run_id,
        "file": entry.file_path,
        "scenario": entry.result.scenario,
        "harness": entry.result.harness,
        "agent": entry.result.agent,
        "model": entry.result.model,
        "version": entry.result.version,
        "highest_gate": entry.result.highest_gate,
        "normalized_score": entry.result.normalized_score
    })
}

fn print_csv(entries: &[ResultEntry]) {
    println!("run_id,file,scenario,harness,agent,model,version,highest_gate,normalized_score");
    for entry in entries {
        println!(
            "{},{},{},{},{},{},{},{},{}",
            entry.run_id,
            entry.file_path.display(),
            entry.result.scenario.as_deref().unwrap_or(""),
            entry.result.harness.as_deref().unwrap_or(""),
            entry.result.agent.as_deref().unwrap_or(""),
            entry.result.model.as_deref().unwrap_or(""),
            entry.result.version.as_deref().unwrap_or(""),
            entry.result.highest_gate.map(|v| v.to_string()).unwrap_or_default(),
            entry.result.normalized_score.map(|v| format!("{v:.4}")).unwrap_or_default()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn load_results_reads_and_sorts_result_files() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(
            temp.path().join("s1-1710000000.json"),
            r#"{"run_id":"s1-1710000000","scenario":"s1","harness":"base-rt","highest_gate":4,"normalized_score":0.9}"#,
        )
        .expect("write result file");
        fs::write(
            temp.path().join("s2-1700000000.json"),
            r#"{"run_id":"s2-1700000000","scenario":"s2","harness":"classic-de","highest_gate":2,"normalized_score":0.5}"#,
        )
        .expect("write result file");

        let entries = load_results(temp.path()).expect("load results");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].run_id, "s1-1710000000");
        assert_eq!(entries[0].result.scenario.as_deref(), Some("s1"));
        assert_eq!(entries[1].run_id, "s2-1700000000");
    }

    #[test]
    fn load_results_parses_stdout_log_results_and_collects_artifacts() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(
            temp.path().join("foo-run2.log"),
            "prefix\n{\"scenario\":\"foo\",\"harness\":\"base-rt\",\"highest_gate\":3,\"normalized_score\":0.7}\n",
        )
        .expect("write stdout log");
        fs::write(temp.path().join("foo-run2.stderr.log"), "stderr\n").expect("write stderr");

        let entries = load_results(temp.path()).expect("load results");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].run_id, "foo-run2");
        assert!(entries[0].artifacts.stderr.is_some());
    }

    #[test]
    fn load_results_errors_on_invalid_json() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(temp.path().join("bad.json"), "{not-json").expect("write file");

        let err = load_results(temp.path()).expect_err("expected parse failure");
        assert!(err.to_string().contains("Invalid result JSON"));
    }
}
