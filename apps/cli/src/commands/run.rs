use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
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
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::{info, warn};

const SCENARIO_REGISTRY_DIR: &str = "apps/web/data/scenarios";
const AGENT_STDOUT_START: &str = "__DEC_BENCH_AGENT_STDOUT_START__";
const AGENT_STDOUT_END: &str = "__DEC_BENCH_AGENT_STDOUT_END__";
const AGENT_RAW_START: &str = "__DEC_BENCH_AGENT_RAW_JSON_START__";
const AGENT_RAW_END: &str = "__DEC_BENCH_AGENT_RAW_JSON_END__";
const AGENT_TRACE_START: &str = "__DEC_BENCH_AGENT_TRACE_JSON_START__";
const AGENT_TRACE_END: &str = "__DEC_BENCH_AGENT_TRACE_JSON_END__";
const RUN_META_START: &str = "__DEC_BENCH_RUN_META_JSON_START__";
const RUN_META_END: &str = "__DEC_BENCH_RUN_META_JSON_END__";
const SESSION_JSONL_START: &str = "__DEC_BENCH_SESSION_JSONL_START__";
const SESSION_JSONL_END: &str = "__DEC_BENCH_SESSION_JSONL_END__";
const EVAL_RESULT_START: &str = "__DEC_BENCH_EVAL_RESULT_JSON_START__";
const EVAL_RESULT_END: &str = "__DEC_BENCH_EVAL_RESULT_JSON_END__";
const ASSERTION_LOG_START: &str = "__DEC_BENCH_ASSERTION_LOG_JSON_START__";
const ASSERTION_LOG_END: &str = "__DEC_BENCH_ASSERTION_LOG_JSON_END__";

#[derive(Args, Clone)]
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

    /// Maximum matrix runs to execute in parallel ("auto" or positive integer)
    #[arg(long, default_value = "1", value_parser = parse_parallelism)]
    pub parallel: Parallelism,

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

#[derive(Clone, Debug)]
pub enum Parallelism {
    Auto,
    Fixed(usize),
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

        let mut jobs: Vec<(String, Persona, PlanMode)> = vec![];
        for scenario in &scenarios {
            for persona in [Persona::Naive, Persona::Savvy] {
                for mode in [PlanMode::NoPlan, PlanMode::Plan] {
                    jobs.push((scenario.id.clone(), persona.clone(), mode.clone()));
                }
            }
        }

        let parallel = resolve_parallelism(&args.parallel);

        if parallel == 1 {
            for (scenario_id, persona, mode) in jobs {
                run_single(&docker, &args, &scenario_id, persona, mode).await?;
            }
        } else {
            info!(parallel, total = jobs.len(), "Running matrix in parallel");

            let semaphore = Arc::new(Semaphore::new(parallel));
            let mut join_set = JoinSet::new();

            for (scenario_id, persona, mode) in jobs {
                let docker = docker.clone();
                let args = args.clone();
                let permit = semaphore
                    .clone()
                    .acquire_owned()
                    .await
                    .context("Failed to acquire parallel run slot")?;

                join_set.spawn(async move {
                    let _permit = permit;
                    run_single(&docker, &args, &scenario_id, persona, mode).await
                });
            }

            let mut had_failures = false;
            while let Some(joined) = join_set.join_next().await {
                match joined {
                    Ok(Ok(())) => {}
                    Ok(Err(err)) => {
                        had_failures = true;
                        warn!("Matrix run failed: {err}");
                    }
                    Err(err) => {
                        had_failures = true;
                        warn!("Matrix task panicked or was cancelled: {err}");
                    }
                }
            }

            if had_failures {
                bail!("One or more matrix runs failed");
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

    let agent_stdout = extract_marked_block(&stdout_buffer, AGENT_STDOUT_START, AGENT_STDOUT_END);
    let agent_raw_json = extract_marked_block(&stdout_buffer, AGENT_RAW_START, AGENT_RAW_END);
    let agent_trace_json = extract_marked_block(&stdout_buffer, AGENT_TRACE_START, AGENT_TRACE_END);
    let run_meta_json = extract_marked_block(&stdout_buffer, RUN_META_START, RUN_META_END);
    let session_jsonl = extract_marked_block(&stdout_buffer, SESSION_JSONL_START, SESSION_JSONL_END);
    let marked_result_json = extract_marked_block(&stdout_buffer, EVAL_RESULT_START, EVAL_RESULT_END);
    let assertion_log_json = extract_marked_block(&stdout_buffer, ASSERTION_LOG_START, ASSERTION_LOG_END);

    let mut cleaned_stdout = stdout_buffer.clone();
    for (start, end) in [
        (AGENT_STDOUT_START, AGENT_STDOUT_END),
        (AGENT_RAW_START, AGENT_RAW_END),
        (AGENT_TRACE_START, AGENT_TRACE_END),
        (RUN_META_START, RUN_META_END),
        (SESSION_JSONL_START, SESSION_JSONL_END),
        (EVAL_RESULT_START, EVAL_RESULT_END),
        (ASSERTION_LOG_START, ASSERTION_LOG_END),
    ] {
        cleaned_stdout = strip_marked_block(&cleaned_stdout, start, end);
    }

    let result_json = marked_result_json
        .as_deref()
        .and_then(parse_json_value)
        .unwrap_or_else(|| extract_result_json(&cleaned_stdout, scenario_id, &args.harness, exit_code));
    let output_path = write_result_file(&args.results_dir, scenario_id, &result_json)?;
    println!("Wrote result: {}", output_path.display());

    let stdout_path = output_path.with_extension("stdout");
    let output_stdout = match agent_stdout {
        Some(value) => {
            if value.trim().is_empty() {
                "[agent-output] no assistant text block captured; inspect trace logs for full interaction events.\n"
                    .to_string()
            } else {
                value
            }
        }
        None => cleaned_stdout.clone(),
    };
    fs::write(&stdout_path, output_stdout)
        .with_context(|| format!("Failed to write {}", stdout_path.display()))?;
    println!("Wrote stdout: {}", stdout_path.display());

    if !cleaned_stdout.trim().is_empty() {
        let infra_stdout_path = output_path.with_extension("infra.stdout");
        fs::write(&infra_stdout_path, &cleaned_stdout)
            .with_context(|| format!("Failed to write {}", infra_stdout_path.display()))?;
        println!("Wrote infra stdout: {}", infra_stdout_path.display());
    }

    if let Some(content) = run_meta_json.filter(|value| !value.trim().is_empty()) {
        let run_meta_path = output_path.with_extension("run-meta.json");
        fs::write(&run_meta_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", run_meta_path.display()))?;
        println!("Wrote run metadata: {}", run_meta_path.display());
    }

    if let Some(content) = agent_raw_json.filter(|value| !value.trim().is_empty()) {
        let raw_path = output_path.with_extension("agent-raw.json");
        fs::write(&raw_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", raw_path.display()))?;
        println!("Wrote agent raw: {}", raw_path.display());
    }

    if let Some(content) = agent_trace_json.filter(|value| !value.trim().is_empty()) {
        let trace_path = output_path.with_extension("trace.json");
        fs::write(&trace_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", trace_path.display()))?;
        println!("Wrote trace: {}", trace_path.display());
    }

    if let Some(content) = session_jsonl.filter(|value| !value.trim().is_empty()) {
        let session_path = output_path.with_extension("session.jsonl");
        fs::write(&session_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", session_path.display()))?;
        println!("Wrote session JSONL: {}", session_path.display());
    }

    if let Some(content) = assertion_log_json.filter(|value| !value.trim().is_empty()) {
        let assertion_log_path = output_path.with_extension("assertion-log.json");
        fs::write(&assertion_log_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", assertion_log_path.display()))?;
        println!("Wrote assertion log: {}", assertion_log_path.display());
    }

    if !stderr_buffer.is_empty() {
        let stderr_path = output_path.with_extension("stderr");
        fs::write(&stderr_path, &stderr_buffer)
            .with_context(|| format!("Failed to write {}", stderr_path.display()))?;
        println!("Wrote stderr: {}", stderr_path.display());
    }

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

fn parse_json_value(raw: &str) -> Option<serde_json::Value> {
    serde_json::from_str::<serde_json::Value>(raw.trim()).ok()
}

fn extract_marked_block(stdout_buffer: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start = stdout_buffer.find(start_marker)?;
    let after_start = start + start_marker.len();
    let remainder = &stdout_buffer[after_start..];
    let end_rel = remainder.find(end_marker)?;
    let mut content = remainder[..end_rel].to_string();
    if let Some(trimmed) = content.strip_prefix('\n') {
        content = trimmed.to_string();
    }
    Some(content.trim_end_matches('\n').to_string())
}

fn strip_marked_block(stdout_buffer: &str, start_marker: &str, end_marker: &str) -> String {
    let start = match stdout_buffer.find(start_marker) {
        Some(value) => value,
        None => return stdout_buffer.to_string(),
    };
    let after_start = start + start_marker.len();
    let remainder = &stdout_buffer[after_start..];
    let end_rel = match remainder.find(end_marker) {
        Some(value) => value,
        None => return stdout_buffer.to_string(),
    };
    let end = after_start + end_rel + end_marker.len();
    let mut output = String::with_capacity(stdout_buffer.len());
    output.push_str(&stdout_buffer[..start]);
    output.push_str(&stdout_buffer[end..]);
    output
}

fn ensure_trailing_newline(content: &str) -> String {
    if content.ends_with('\n') {
        content.to_string()
    } else {
        format!("{content}\n")
    }
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

fn parse_parallelism(value: &str) -> std::result::Result<Parallelism, String> {
    if value.eq_ignore_ascii_case("auto") {
        return Ok(Parallelism::Auto);
    }

    let parsed = value
        .parse::<usize>()
        .map_err(|_| "parallel must be 'auto' or a positive integer".to_string())?;
    if parsed == 0 {
        return Err("parallel must be >= 1".to_string());
    }
    Ok(Parallelism::Fixed(parsed))
}

fn resolve_parallelism(parallelism: &Parallelism) -> usize {
    match parallelism {
        Parallelism::Auto => std::thread::available_parallelism()
            .map(|v| v.get())
            .unwrap_or(1),
        Parallelism::Fixed(value) => *value,
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
        let parsed = extract_result_json("no json here", "scenario-a", "classic-de", 17);
        assert_eq!(parsed["scenario"], "scenario-a");
        assert_eq!(parsed["harness"], "classic-de");
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

    #[test]
    fn parse_parallelism_accepts_auto() {
        let parsed = parse_parallelism("auto").expect("auto is valid");
        assert!(matches!(parsed, Parallelism::Auto));
    }

    #[test]
    fn parse_parallelism_accepts_positive_integer() {
        let parsed = parse_parallelism("4").expect("positive int is valid");
        assert!(matches!(parsed, Parallelism::Fixed(4)));
    }

    #[test]
    fn parse_parallelism_rejects_zero() {
        let err = parse_parallelism("0").expect_err("zero should be rejected");
        assert!(err.contains(">= 1"));
    }
}
