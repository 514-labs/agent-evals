use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Args;
use serde::Deserialize;

#[derive(Args)]
pub struct ResultsArgs {
    /// Filter results by scenario ID
    #[arg(short, long)]
    pub scenario: Option<String>,

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

    match args.format {
        OutputFormat::Table => print_table(&results),
        OutputFormat::Json => print_json(&results)?,
        OutputFormat::Csv => print_csv(&results),
    }

    Ok(())
}

#[derive(Debug)]
struct ResultEntry {
    file_name: String,
    result: ResultPayload,
}

#[derive(Debug, Deserialize)]
struct ResultPayload {
    scenario: Option<String>,
    harness: Option<String>,
    agent: Option<String>,
    model: Option<String>,
    highest_gate: Option<u8>,
    normalized_score: Option<f64>,
}

fn load_results(dir: &PathBuf) -> Result<Vec<ResultEntry>> {
    let mut output = vec![];
    for entry in fs::read_dir(dir).with_context(|| format!("Failed to read {}", dir.display()))? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let raw =
            fs::read_to_string(&path).with_context(|| format!("Failed to read {}", path.display()))?;
        let payload: ResultPayload = serde_json::from_str(&raw)
            .with_context(|| format!("Invalid result JSON in {}", path.display()))?;

        output.push(ResultEntry {
            file_name: path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| path.display().to_string()),
            result: payload,
        });
    }

    output.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(output)
}

fn print_table(entries: &[ResultEntry]) {
    if entries.is_empty() {
        println!("No result files found.");
        return;
    }

    println!(
        "{:<36} {:<12} {:<14} {:<26} {:<6} {:<8} {}",
        "SCENARIO", "HARNESS", "AGENT", "MODEL", "GATE", "SCORE", "FILE"
    );
    println!("{}", "-".repeat(128));

    for entry in entries {
        let scenario = entry.result.scenario.as_deref().unwrap_or("-");
        let harness = entry.result.harness.as_deref().unwrap_or("-");
        let agent = entry.result.agent.as_deref().unwrap_or("-");
        let model = entry.result.model.as_deref().unwrap_or("-");
        let gate = entry
            .result
            .highest_gate
            .map(|v| v.to_string())
            .unwrap_or_else(|| "-".to_string());
        let score = entry
            .result
            .normalized_score
            .map(|v| format!("{v:.2}"))
            .unwrap_or_else(|| "-".to_string());

        println!(
            "{:<36} {:<12} {:<14} {:<26} {:<6} {:<8} {}",
            scenario, harness, agent, model, gate, score, entry.file_name
        );
    }
}

fn print_json(entries: &[ResultEntry]) -> Result<()> {
    let payload: Vec<_> = entries
        .iter()
        .map(|entry| {
            serde_json::json!({
                "file": entry.file_name,
                "scenario": entry.result.scenario,
                "harness": entry.result.harness,
                "agent": entry.result.agent,
                "model": entry.result.model,
                "highest_gate": entry.result.highest_gate,
                "normalized_score": entry.result.normalized_score
            })
        })
        .collect();

    println!("{}", serde_json::to_string_pretty(&payload)?);
    Ok(())
}

fn print_csv(entries: &[ResultEntry]) {
    println!("file,scenario,harness,agent,model,highest_gate,normalized_score");
    for entry in entries {
        println!(
            "{},{},{},{},{},{},{}",
            entry.file_name,
            entry.result.scenario.as_deref().unwrap_or(""),
            entry.result.harness.as_deref().unwrap_or(""),
            entry.result.agent.as_deref().unwrap_or(""),
            entry.result.model.as_deref().unwrap_or(""),
            entry
                .result
                .highest_gate
                .map(|v| v.to_string())
                .unwrap_or_default(),
            entry
                .result
                .normalized_score
                .map(|v| format!("{v:.4}"))
                .unwrap_or_default()
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
            temp.path().join("b.json"),
            r#"{"scenario":"s2","harness":"classic-de","highest_gate":2,"normalized_score":0.5}"#,
        )
        .expect("write result file");
        fs::write(
            temp.path().join("a.json"),
            r#"{"scenario":"s1","harness":"base-rt","highest_gate":4,"normalized_score":0.9}"#,
        )
        .expect("write result file");

        let entries = load_results(&temp.path().to_path_buf()).expect("load results");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].file_name, "a.json");
        assert_eq!(entries[0].result.scenario.as_deref(), Some("s1"));
        assert_eq!(entries[1].file_name, "b.json");
    }

    #[test]
    fn load_results_errors_on_invalid_json() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(temp.path().join("bad.json"), "{not-json").expect("write file");

        let err = load_results(&temp.path().to_path_buf()).expect_err("expected parse failure");
        assert!(err.to_string().contains("Invalid result JSON"));
    }
}
