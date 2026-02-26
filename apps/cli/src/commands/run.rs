use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, LogOutput, LogsOptions, StartContainerOptions, WaitContainerOptions,
};
use bollard::models::HostConfig;
use bollard::Docker;
use clap::Args;
use futures_util::stream::StreamExt;
use serde::Deserialize;
use tracing::{info, warn};

const SCENARIO_REGISTRY_DIR: &str = "apps/web/data/scenarios";

#[derive(Args)]
pub struct RunArgs {
    /// Scenario ID to run
    #[arg(short, long)]
    pub scenario: Option<String>,

    /// Evaluation harness to use
    #[arg(long, default_value = "bare")]
    pub harness: String,

    /// Agent persona
    #[arg(long, value_enum, default_value = "naive")]
    pub persona: Persona,

    /// Planning mode
    #[arg(long, value_enum, default_value = "no-plan")]
    pub mode: PlanMode,

    /// Run all scenario/persona/mode combinations
    #[arg(long)]
    pub matrix: bool,

    /// Agent runner ID baked into the image tag
    #[arg(long, default_value = "claude-code")]
    pub agent: String,

    /// Model slug baked into the image tag
    #[arg(long, default_value = "claude-sonnet-4-20250514")]
    pub model: String,

    /// Image version suffix
    #[arg(long, default_value = "v1.0.0")]
    pub version: String,

    /// Directory where run outputs are persisted
    #[arg(long, default_value = "results")]
    pub results_dir: String,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Persona {
    Naive,
    Savvy,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum PlanMode {
    Plan,
    NoPlan,
}

pub async fn execute(args: RunArgs) -> Result<()> {
    if args.matrix {
        let docker = Docker::connect_with_local_defaults().context("Failed to connect to Docker daemon")?;
        info!("Running full eval matrix");
        let registry_dir = resolve_repo_path(SCENARIO_REGISTRY_DIR)?;
        let scenarios = load_registry_scenarios(&registry_dir)?;
        if scenarios.is_empty() {
            bail!("No scenarios found in {}", registry_dir.display());
        }

        for scenario in scenarios {
            for persona in [Persona::Naive, Persona::Savvy] {
                for mode in [PlanMode::NoPlan, PlanMode::Plan] {
                    run_single(&docker, &args, &scenario.id, persona.clone(), mode.clone()).await?;
                }
            }
        }
        return Ok(());
    }

    let scenario = args
        .scenario
        .as_deref()
        .context("--scenario is required unless --matrix is enabled")?;
    let docker = Docker::connect_with_local_defaults().context("Failed to connect to Docker daemon")?;
    info!(scenario, harness = %args.harness, "Starting eval run");
    run_single(
        &docker,
        &args,
        scenario,
        args.persona.clone(),
        args.mode.clone(),
    )
    .await?;

    Ok(())
}

async fn run_single(
    docker: &Docker,
    args: &RunArgs,
    scenario_id: &str,
    persona: Persona,
    mode: PlanMode,
) -> Result<()> {
    let image = format!(
        "{}.{}.{}.{}.{}",
        scenario_id, args.harness, args.agent, args.model, args.version
    );
    let timestamp = unix_timestamp();
    let container_name = format!("dec-bench-{}-{}", scenario_id, timestamp);

    println!(
        "Running scenario={} harness={} persona={:?} mode={:?} image={}",
        scenario_id, args.harness, persona, mode, image
    );

    let mut env = vec![
        format!("PERSONA={}", persona.as_str()),
        format!("PLAN_MODE={}", mode.as_str()),
        format!("EVAL_SCENARIO={}", scenario_id),
        format!("EVAL_HARNESS={}", args.harness),
        format!("EVAL_AGENT={}", args.agent),
        format!("EVAL_VERSION={}", args.version),
        format!("MODEL={}", args.model),
    ];
    for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "POSTGRES_URL", "CLICKHOUSE_URL"] {
        if let Ok(value) = std::env::var(key) {
            env.push(format!("{key}={value}"));
        }
    }

    docker
        .create_container(
            Some(CreateContainerOptions {
                name: container_name.as_str(),
                platform: None,
            }),
            Config::<String> {
                image: Some(image.clone()),
                env: Some(env),
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                host_config: Some(HostConfig {
                    auto_remove: Some(true),
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await
        .with_context(|| format!("Failed to create container from image '{image}'"))?;

    docker
        .start_container(&container_name, None::<StartContainerOptions<String>>)
        .await
        .with_context(|| format!("Failed to start container '{}'", container_name))?;

    let mut log_stream = docker.logs::<String>(
        &container_name,
        Some(LogsOptions {
            follow: true,
            stdout: true,
            stderr: true,
            timestamps: false,
            tail: "all".to_string(),
            ..Default::default()
        }),
    );

    let mut stdout_buffer = String::new();
    let mut stderr_buffer = String::new();
    while let Some(message) = log_stream.next().await {
        match message? {
            LogOutput::StdOut { message } => {
                let text = String::from_utf8_lossy(&message).to_string();
                print!("{text}");
                stdout_buffer.push_str(&text);
            }
            LogOutput::StdErr { message } => {
                let text = String::from_utf8_lossy(&message).to_string();
                eprint!("{text}");
                stderr_buffer.push_str(&text);
            }
            LogOutput::StdIn { message } | LogOutput::Console { message } => {
                let text = String::from_utf8_lossy(&message).to_string();
                print!("{text}");
                stdout_buffer.push_str(&text);
            }
        }
    }

    let mut wait_stream = docker.wait_container(
        &container_name,
        Some(WaitContainerOptions {
            condition: "not-running".to_string(),
        }),
    );
    let mut exit_code = 1_i64;
    if let Some(result) = wait_stream.next().await {
        let status = result?;
        exit_code = status.status_code;
    }

    let result_json = extract_result_json(&stdout_buffer, scenario_id, &args.harness, exit_code);
    let output_path = write_result_file(&args.results_dir, scenario_id, &result_json)?;
    println!("Wrote result: {}", output_path.display());

    if exit_code != 0 {
        warn!(
            scenario_id,
            harness = %args.harness,
            persona = ?persona,
            mode = ?mode,
            "Container exited non-zero: {}",
            exit_code
        );
    }

    if !stderr_buffer.is_empty() {
        warn!("Container produced stderr output.");
    }

    Ok(())
}

fn extract_result_json(
    stdout_buffer: &str,
    scenario_id: &str,
    harness: &str,
    exit_code: i64,
) -> serde_json::Value {
    for line in stdout_buffer.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            return value;
        }
    }

    serde_json::json!({
        "scenario": scenario_id,
        "harness": harness,
        "highest_gate": 0,
        "normalized_score": 0.0,
        "error": "No structured JSON result found in container output.",
        "container_exit_code": exit_code
    })
}

fn write_result_file(results_dir: &str, scenario_id: &str, value: &serde_json::Value) -> Result<PathBuf> {
    let dir = PathBuf::from(results_dir);
    fs::create_dir_all(&dir).with_context(|| format!("Failed to create {}", dir.display()))?;
    let filename = format!("{}-{}.json", scenario_id, unix_timestamp());
    let output_path = dir.join(filename);
    let payload = serde_json::to_string_pretty(value)?;
    fs::write(&output_path, format!("{payload}\n"))
        .with_context(|| format!("Failed to write {}", output_path.display()))?;
    Ok(output_path)
}

fn resolve_repo_path(rel: &str) -> Result<PathBuf> {
    let cwd = std::env::current_dir().context("Failed to determine current directory")?;
    for ancestor in cwd.ancestors() {
        let candidate = ancestor.join(rel);
        if candidate.exists() || ancestor.join(".git").exists() {
            return Ok(candidate);
        }
    }
    Ok(cwd.join(rel))
}

#[derive(Debug, Deserialize)]
struct RegistryScenario {
    id: String,
}

fn load_registry_scenarios(dir: &Path) -> Result<Vec<RegistryScenario>> {
    let mut scenarios = vec![];
    for entry in fs::read_dir(dir).with_context(|| format!("Failed to read {}", dir.display()))? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read {}", path.display()))?;
        let scenario: RegistryScenario = serde_json::from_str(&raw)
            .with_context(|| format!("Invalid registry JSON: {}", path.display()))?;
        scenarios.push(scenario);
    }
    scenarios.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(scenarios)
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

impl Persona {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Naive => "naive",
            Self::Savvy => "savvy",
        }
    }
}

impl PlanMode {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Plan => "plan",
            Self::NoPlan => "no-plan",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn extract_result_json_uses_last_valid_json_line() {
        let output = "some log\n{\"scenario\":\"wrong\"}\n{\"scenario\":\"ok\",\"highest_gate\":4}";
        let parsed = extract_result_json(output, "fallback", "bare", 0);
        assert_eq!(parsed["scenario"], "ok");
        assert_eq!(parsed["highest_gate"], 4);
    }

    #[test]
    fn extract_result_json_falls_back_when_no_json_found() {
        let parsed = extract_result_json("no json here", "scenario-a", "dbt", 17);
        assert_eq!(parsed["scenario"], "scenario-a");
        assert_eq!(parsed["harness"], "dbt");
        assert_eq!(parsed["container_exit_code"], 17);
        assert!(parsed["error"].as_str().unwrap_or("").contains("No structured JSON"));
    }

    #[test]
    fn write_result_file_writes_json_payload() {
        let temp = tempfile::tempdir().expect("temp dir");
        let payload = serde_json::json!({
            "scenario": "test-scenario",
            "highest_gate": 3
        });

        let path = write_result_file(temp.path().to_str().unwrap_or(""), "test-scenario", &payload)
            .expect("write_result_file succeeds");
        let raw = fs::read_to_string(path).expect("result file readable");
        let value: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
        assert_eq!(value["scenario"], "test-scenario");
        assert_eq!(value["highest_gate"], 3);
    }

    #[test]
    fn load_registry_scenarios_reads_and_sorts_json_files() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(
            temp.path().join("b.json"),
            "{\"id\":\"b\"}\n",
        )
        .expect("write file");
        fs::write(
            temp.path().join("a.json"),
            "{\"id\":\"a\"}\n",
        )
        .expect("write file");
        fs::write(temp.path().join("ignore.txt"), "nope").expect("write file");

        let scenarios = load_registry_scenarios(temp.path()).expect("loads scenarios");
        assert_eq!(scenarios.len(), 2);
        assert_eq!(scenarios[0].id, "a");
        assert_eq!(scenarios[1].id, "b");
    }
}
