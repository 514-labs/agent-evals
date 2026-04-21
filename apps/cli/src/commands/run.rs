use std::fs;
use std::io::{self, IsTerminal};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, KillContainerOptions, LogOutput, LogsOptions,
    RemoveContainerOptions, StartContainerOptions, WaitContainerOptions,
};
use bollard::models::HostConfig;
use bollard::Docker;
use clap::Args;
use futures_util::stream::StreamExt;
use serde::Deserialize;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::{info, warn};

use super::preflight;

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
const SERVICE_LOGS_START: &str = "__DEC_BENCH_SERVICE_LOGS_JSON_START__";
const SERVICE_LOGS_END: &str = "__DEC_BENCH_SERVICE_LOGS_JSON_END__";
const SENSITIVE_ENV_KEYS: [&str; 4] = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
    "CURSOR_API_KEY",
];

/// Agent/model pair for matrix runs (e.g. "claude-code:claude-sonnet-4-6")
#[derive(Clone, Debug)]
pub struct AgentModel {
    pub agent: String,
    pub model: String,
}

fn parse_agent_model(value: &str) -> std::result::Result<AgentModel, String> {
    let parts: Vec<&str> = value.splitn(2, ':').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err(format!(
            "Invalid agent:model pair '{}'. Expected format: agent:model (e.g. claude-code:claude-sonnet-4-6)",
            value
        ));
    }
    Ok(AgentModel {
        agent: parts[0].to_string(),
        model: parts[1].to_string(),
    })
}

#[derive(Args, Clone)]
pub struct RunArgs {
    /// Scenario ID to run (single-run mode) or filter (matrix mode)
    #[arg(short, long)]
    pub scenario: Option<String>,

    /// Evaluation harness to use (single-run mode) or filter (matrix mode)
    #[arg(long, default_value = "base-rt")]
    pub harness: String,

    /// Agent persona (matrix mode runs both when omitted)
    #[arg(long, value_enum)]
    pub persona: Option<Persona>,

    /// Planning mode
    #[arg(long, value_enum, default_value = "no-plan")]
    pub mode: PlanMode,

    /// Run all scenario/agent combinations in the matrix
    #[arg(long)]
    pub matrix: bool,

    /// Maximum matrix runs to execute in parallel ("auto" or positive integer)
    #[arg(long, default_value = "1", value_parser = parse_parallelism)]
    pub parallel: Parallelism,

    /// Agent runner ID baked into the image tag (single-run mode)
    #[arg(long, default_value = "claude-code")]
    pub agent: String,

    /// Model slug baked into the image tag (single-run mode)
    #[arg(long, default_value = "claude-sonnet-4-20250514")]
    pub model: String,

    /// Agent:model pairs for matrix mode (repeatable, e.g. --agents claude-code:claude-sonnet-4-6 --agents codex:gpt-5.4)
    #[arg(long = "agents", value_parser = parse_agent_model)]
    pub agent_models: Vec<AgentModel>,

    /// Image version suffix
    #[arg(long, default_value = "v0.2.0")]
    pub version: String,

    /// Directory where run outputs are persisted
    #[arg(long, default_value = "results")]
    pub results_dir: String,

    /// Timeout per run in minutes (0 = no timeout)
    #[arg(long, default_value = "0")]
    pub timeout: u64,

    /// Maximum number of runs to execute (0 = no limit)
    #[arg(long, default_value = "0")]
    pub limit: usize,

    /// Skip runs that already have result files
    #[arg(long)]
    pub skip_existing: bool,

    /// List all matrix jobs without executing them
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Persona {
    Baseline,
    Informed,
    MooseUser,
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

/// A single job in the matrix: scenario + harness + agent + model + persona + mode
#[derive(Clone, Debug)]
struct MatrixJob {
    scenario_id: String,
    harness: String,
    agent: String,
    model: String,
    persona: Persona,
    mode: PlanMode,
}

const DEFAULT_AGENTS: &[(&str, &str)] = &[
    ("claude-code", "claude-sonnet-4-6"),
    ("claude-code", "claude-opus-4-6"),
    ("codex", "gpt-5.4"),
    ("cursor", "composer-2"),
];

pub async fn execute(args: RunArgs) -> Result<()> {
    if args.matrix {
        let agent_models: Vec<(String, String)> = if args.agent_models.is_empty() {
            DEFAULT_AGENTS
                .iter()
                .map(|(a, m)| (a.to_string(), m.to_string()))
                .collect()
        } else {
            args.agent_models
                .iter()
                .map(|am| (am.agent.clone(), am.model.clone()))
                .collect()
        };

        // Validate all agent/model/key combos upfront before any Docker work.
        let pairs: Vec<(&str, &str)> = agent_models
            .iter()
            .map(|(a, m)| (a.as_str(), m.as_str()))
            .collect();
        preflight::validate_agent_model_keys(&pairs).await?;

        preflight::check_docker()?;
        let docker = preflight::connect_docker()?;

        let scenarios = load_scenarios_with_harnesses()?;
        if scenarios.is_empty() {
            bail!("No scenarios found");
        }

        let scenario_filter = args.scenario.as_deref();
        let harness_filter = if args.harness != "base-rt" {
            // Only filter by harness if explicitly set (not the default)
            Some(args.harness.as_str())
        } else {
            None
        };

        let mut jobs = build_matrix_jobs(
            &scenarios,
            &agent_models,
            scenario_filter,
            harness_filter,
            &args.persona,
            &args.mode,
        );

        // Apply --skip-existing
        let mut skipped = 0_usize;
        if args.skip_existing {
            let before = jobs.len();
            jobs.retain(|job| {
                match has_existing_result(
                    &args.results_dir,
                    &job.scenario_id,
                    &job.agent,
                    &job.model,
                    &job.harness,
                    job.persona.as_str(),
                ) {
                    Some(existing) => {
                        info!(
                            scenario = job.scenario_id,
                            agent = job.agent,
                            model = job.model,
                            "Skipping — result exists: {existing}"
                        );
                        false
                    }
                    None => true,
                }
            });
            skipped = before - jobs.len();
        }

        // Apply --limit
        if args.limit > 0 && jobs.len() > args.limit {
            jobs.truncate(args.limit);
        }

        let total = jobs.len();
        println!(
            "Matrix: {} jobs to run, {} skipped (existing), {} agents, {} scenarios",
            total,
            skipped,
            agent_models.len(),
            scenarios.len()
        );

        if total == 0 {
            println!("Nothing to run.");
            return Ok(());
        }

        if args.dry_run {
            for (i, job) in jobs.iter().enumerate() {
                println!(
                    "[{}/{}] scenario={} harness={} persona={:?} agent={} model={}",
                    i + 1, total, job.scenario_id, job.harness, job.persona, job.agent, job.model
                );
            }
            return Ok(());
        }

        let parallel = resolve_parallelism(&args.parallel);
        let mut completed = 0_usize;
        let mut failed = 0_usize;

        if parallel == 1 {
            for job in jobs {
                completed += 1;
                println!(
                    "\n[{completed}/{total}] scenario={} harness={} agent={} model={}",
                    job.scenario_id, job.harness, job.agent, job.model
                );
                let job_args = args_for_job(&args, &job);
                match run_single(&docker, &job_args, &job.scenario_id, job.persona, job.mode).await
                {
                    Ok(()) => {}
                    Err(err) => {
                        failed += 1;
                        warn!("Run failed: {err}");
                    }
                }
            }
        } else {
            info!(parallel, total, "Running matrix in parallel");

            let semaphore = Arc::new(Semaphore::new(parallel));
            let mut join_set = JoinSet::new();

            for job in jobs {
                let docker = docker.clone();
                let job_args = args_for_job(&args, &job);
                let permit = semaphore
                    .clone()
                    .acquire_owned()
                    .await
                    .context("Failed to acquire parallel run slot")?;

                join_set.spawn(async move {
                    let _permit = permit;
                    run_single(&docker, &job_args, &job.scenario_id, job.persona, job.mode).await
                });
            }

            while let Some(joined) = join_set.join_next().await {
                completed += 1;
                match joined {
                    Ok(Ok(())) => {}
                    Ok(Err(err)) => {
                        failed += 1;
                        warn!("[{completed}/{total}] Matrix run failed: {err}");
                    }
                    Err(err) => {
                        failed += 1;
                        warn!("[{completed}/{total}] Matrix task panicked: {err}");
                    }
                }
            }
        }

        println!(
            "\nMatrix complete. Total={total} Completed={completed} Failed={failed} Skipped={skipped}"
        );
        if failed > 0 {
            bail!("{failed} of {total} matrix runs failed");
        }
        return Ok(());
    }

    // Single-run mode
    let scenario = args
        .scenario
        .as_deref()
        .context("--scenario is required unless --matrix is enabled")?;

    // Validate agent/model/key upfront before any Docker work.
    preflight::validate_agent_model_keys(&[(&args.agent, &args.model)]).await?;

    preflight::check_docker()?;
    let docker = preflight::connect_docker()?;
    info!(scenario, harness = %args.harness, "Starting eval run");
    run_single(
        &docker,
        &args,
        scenario,
        args.persona.clone().unwrap_or(Persona::Baseline),
        args.mode.clone(),
    )
    .await?;

    Ok(())
}

fn args_for_job(base: &RunArgs, job: &MatrixJob) -> RunArgs {
    let mut args = base.clone();
    args.agent = job.agent.clone();
    args.model = job.model.clone();
    args.harness = job.harness.clone();
    args
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
    if preflight::check_image_exists(&image).is_err() {
        println!("Image not found, building: {image}");
        let build_args = super::build::BuildArgs {
            scenario: scenario_id.to_string(),
            harness: args.harness.clone(),
            agent: args.agent.clone(),
            model: args.model.clone(),
            version: args.version.clone(),
            base_image: "ghcr.io/514-labs/dec-bench:base".to_string(),
            overrides: Vec::new(),
            dry_run: false,
        };
        super::build::execute(build_args)
            .await
            .with_context(|| format!("Failed to build image '{image}'"))?;
    }

    let default_run_id = make_run_id(args, scenario_id, &persona, &mode);
    let container_name = format!("dec-bench-{default_run_id}");

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
    for key in [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "CODEX_API_KEY",
        "CURSOR_API_KEY",
        "POSTGRES_URL",
        "CLICKHOUSE_URL",
    ] {
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
                host_config: Some(HostConfig::default()),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("500") || msg.contains("server error") {
                anyhow::anyhow!(
                    "Failed to create container from image '{image}': \
                     Docker daemon returned a server error.\n\n\
                     This usually means the Docker daemon is not running or is in a bad state.\n\
                     Start Docker Desktop or restart the Docker daemon, then try again.\n\n\
                     Original error: {e}"
                )
            } else {
                anyhow::anyhow!("Failed to create container from image '{image}': {e}")
            }
        })?;

    docker
        .start_container(&container_name, None::<StartContainerOptions<String>>)
        .await
        .with_context(|| format!("Failed to start container '{}'", container_name))?;

    let timeout_duration = if args.timeout > 0 {
        Some(Duration::from_secs(args.timeout * 60))
    } else {
        None
    };

    let container_name_clone = container_name.clone();
    let docker_clone = docker.clone();

    let run_container = async {
        let mut log_stream = docker_clone.logs::<String>(
            &container_name_clone,
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

        let mut wait_stream = docker_clone.wait_container(
            &container_name_clone,
            Some(WaitContainerOptions {
                condition: "not-running".to_string(),
            }),
        );
        let mut exit_code = 1_i64;
        if let Some(result) = wait_stream.next().await {
            let status = result?;
            exit_code = status.status_code;
        }

        Ok::<(String, String, i64), anyhow::Error>((stdout_buffer, stderr_buffer, exit_code))
    };

    let (stdout_buffer, stderr_buffer, exit_code) = if let Some(duration) = timeout_duration {
        match tokio::time::timeout(duration, run_container).await {
            Ok(result) => result?,
            Err(_) => {
                warn!(
                    scenario_id,
                    "Run timed out after {} minutes — killing container",
                    args.timeout
                );
                let _ = docker
                    .kill_container(
                        &container_name,
                        Some(KillContainerOptions { signal: "SIGKILL" }),
                    )
                    .await;
                let _ = docker
                    .remove_container(
                        &container_name,
                        Some(RemoveContainerOptions {
                            force: true,
                            ..Default::default()
                        }),
                    )
                    .await;
                bail!(
                    "Run timed out after {} minutes for scenario '{}'",
                    args.timeout,
                    scenario_id
                );
            }
        }
    } else {
        run_container.await?
    };

    let _ = docker
        .remove_container(
            &container_name,
            Some(RemoveContainerOptions {
                force: true,
                ..Default::default()
            }),
        )
        .await;

    let agent_stdout = extract_marked_block(&stdout_buffer, AGENT_STDOUT_START, AGENT_STDOUT_END);
    let agent_raw_json = extract_marked_block(&stdout_buffer, AGENT_RAW_START, AGENT_RAW_END);
    let agent_trace_json = extract_marked_block(&stdout_buffer, AGENT_TRACE_START, AGENT_TRACE_END);
    let run_meta_json = extract_marked_block(&stdout_buffer, RUN_META_START, RUN_META_END);
    let session_jsonl = extract_marked_block(&stdout_buffer, SESSION_JSONL_START, SESSION_JSONL_END);
    let marked_result_json = extract_marked_block(&stdout_buffer, EVAL_RESULT_START, EVAL_RESULT_END);
    let assertion_log_json = extract_marked_block(&stdout_buffer, ASSERTION_LOG_START, ASSERTION_LOG_END);
    let service_logs_json = extract_marked_block(&stdout_buffer, SERVICE_LOGS_START, SERVICE_LOGS_END);

    let mut cleaned_stdout = stdout_buffer.clone();
    for (start, end) in [
        (AGENT_STDOUT_START, AGENT_STDOUT_END),
        (AGENT_RAW_START, AGENT_RAW_END),
        (AGENT_TRACE_START, AGENT_TRACE_END),
        (RUN_META_START, RUN_META_END),
        (SESSION_JSONL_START, SESSION_JSONL_END),
        (EVAL_RESULT_START, EVAL_RESULT_END),
        (ASSERTION_LOG_START, ASSERTION_LOG_END),
        (SERVICE_LOGS_START, SERVICE_LOGS_END),
    ] {
        cleaned_stdout = strip_marked_block(&cleaned_stdout, start, end);
    }

    let mut result_json = marked_result_json
        .as_deref()
        .and_then(parse_json_value)
        .unwrap_or_else(|| extract_result_json(&cleaned_stdout, scenario_id, &args.harness, exit_code));
    let (output_path, run_id) =
        write_result_file(&args.results_dir, &default_run_id, &mut result_json)?;

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

    let mut written_files: Vec<&str> = vec!["result.json", "stdout"];

    if !cleaned_stdout.trim().is_empty() {
        let infra_stdout_path = output_path.with_extension("infra.stdout");
        fs::write(&infra_stdout_path, &cleaned_stdout)
            .with_context(|| format!("Failed to write {}", infra_stdout_path.display()))?;
        written_files.push("infra.stdout");
    }

    if let Some(content) = run_meta_json.filter(|value| !value.trim().is_empty()) {
        let run_meta_path = output_path.with_extension("run-meta.json");
        fs::write(
            &run_meta_path,
            ensure_trailing_newline(&sanitize_sensitive_content(&content)),
        )
            .with_context(|| format!("Failed to write {}", run_meta_path.display()))?;
        written_files.push("run-meta.json");
    }

    if let Some(content) = agent_raw_json.filter(|value| !value.trim().is_empty()) {
        let raw_path = output_path.with_extension("agent-raw.json");
        fs::write(
            &raw_path,
            ensure_trailing_newline(&sanitize_sensitive_content(&content)),
        )
            .with_context(|| format!("Failed to write {}", raw_path.display()))?;
        written_files.push("agent-raw.json");
    }

    if let Some(content) = agent_trace_json.filter(|value| !value.trim().is_empty()) {
        let trace_path = output_path.with_extension("trace.json");
        fs::write(
            &trace_path,
            ensure_trailing_newline(&sanitize_sensitive_content(&content)),
        )
            .with_context(|| format!("Failed to write {}", trace_path.display()))?;
        written_files.push("trace.json");
    }

    if let Some(content) = session_jsonl.filter(|value| !value.trim().is_empty()) {
        let session_path = output_path.with_extension("session.jsonl");
        fs::write(
            &session_path,
            ensure_trailing_newline(&sanitize_sensitive_content(&content)),
        )
            .with_context(|| format!("Failed to write {}", session_path.display()))?;
        written_files.push("session.jsonl");
    }

    if let Some(content) = assertion_log_json.filter(|value| !value.trim().is_empty()) {
        let assertion_log_path = output_path.with_extension("assertion-log.json");
        fs::write(&assertion_log_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", assertion_log_path.display()))?;
        written_files.push("assertion-log.json");
    }

    if let Some(content) = service_logs_json.filter(|value| !value.trim().is_empty()) {
        let service_logs_path = output_path.with_extension("service-logs.json");
        fs::write(&service_logs_path, ensure_trailing_newline(&content))
            .with_context(|| format!("Failed to write {}", service_logs_path.display()))?;
        written_files.push("service-logs.json");
    }

    if !stderr_buffer.is_empty() {
        let stderr_path = output_path.with_extension("stderr");
        fs::write(&stderr_path, &stderr_buffer)
            .with_context(|| format!("Failed to write {}", stderr_path.display()))?;
        written_files.push("stderr");
    }

    println!(
        "Wrote {} files to {}/ [{}]",
        written_files.len(),
        args.results_dir,
        written_files.join(", ")
    );

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

    let use_ansi = stdout_supports_ansi();
    println!();
    println!("{}", "-".repeat(72));
    println!("{}", format_block_heading("Run summary", use_ansi));
    println!("Run ID: {}", format_emphasized_value(&run_id, use_ansi));
    println!("Gate/score: {}", format_gate_and_score_summary(&result_json));
    println!("Result file: {}", output_path.display());
    println!("{}", format_block_heading("Next steps", use_ansi));
    println!("  dec-bench results --run-id {}", run_id);
    println!("  dec-bench audit open --scenario {} --run-id {}  # requires npm", scenario_id, run_id);

    Ok(())
}

fn stdout_supports_ansi() -> bool {
    io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none()
}

fn format_block_heading(label: &str, use_ansi: bool) -> String {
    if use_ansi {
        format!("\x1b[1;36m{label}\x1b[0m")
    } else {
        label.to_string()
    }
}

fn format_emphasized_value(value: &str, use_ansi: bool) -> String {
    if use_ansi {
        format!("\x1b[1m{value}\x1b[0m")
    } else {
        value.to_string()
    }
}

fn format_gate_and_score_summary(value: &serde_json::Value) -> String {
    let highest_gate = value
        .get("highest_gate")
        .and_then(|raw| raw.as_u64())
        .map(|raw| raw.to_string())
        .unwrap_or_else(|| "?".to_string());
    let normalized_score = value
        .get("normalized_score")
        .and_then(|raw| raw.as_f64())
        .map(|raw| format!("{raw:.3}"))
        .unwrap_or_else(|| "?".to_string());
    format!("highest gate {highest_gate} | normalized score {normalized_score}")
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

fn find_line_marker(buffer: &str, marker: &str, from: usize) -> Option<(usize, usize)> {
    let bytes = buffer.as_bytes();
    let mut cursor = from;
    while let Some(rel) = buffer[cursor..].find(marker) {
        let start = cursor + rel;
        let before_ok = start == 0 || bytes.get(start.saturating_sub(1)) == Some(&b'\n');
        let after = start + marker.len();
        let after_ok = after == bytes.len()
            || bytes.get(after) == Some(&b'\n')
            || bytes.get(after) == Some(&b'\r');
        if before_ok && after_ok {
            let mut line_end = after;
            if bytes.get(line_end) == Some(&b'\r') {
                line_end += 1;
            }
            if bytes.get(line_end) == Some(&b'\n') {
                line_end += 1;
            }
            return Some((start, line_end));
        }
        cursor = after;
    }
    None
}

fn collect_marked_blocks(stdout_buffer: &str, start_marker: &str, end_marker: &str) -> Vec<(usize, usize, String)> {
    let mut blocks = vec![];
    let mut cursor = 0;
    while let Some((start_idx, content_start)) = find_line_marker(stdout_buffer, start_marker, cursor) {
        let Some((end_idx, block_end)) = find_line_marker(stdout_buffer, end_marker, content_start) else {
            break;
        };
        let content = stdout_buffer[content_start..end_idx]
            .trim_end_matches('\n')
            .trim_end_matches('\r')
            .to_string();
        blocks.push((start_idx, block_end, content));
        cursor = block_end;
    }
    blocks
}

fn extract_marked_block(stdout_buffer: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let blocks = collect_marked_blocks(stdout_buffer, start_marker, end_marker);
    blocks.last().map(|(_, _, content)| content.clone())
}

fn strip_marked_block(stdout_buffer: &str, start_marker: &str, end_marker: &str) -> String {
    let blocks = collect_marked_blocks(stdout_buffer, start_marker, end_marker);
    if blocks.is_empty() {
        return stdout_buffer.to_string();
    }
    let mut output = String::with_capacity(stdout_buffer.len());
    let mut cursor = 0;
    for (start, end, _) in blocks {
        output.push_str(&stdout_buffer[cursor..start]);
        cursor = end;
    }
    output.push_str(&stdout_buffer[cursor..]);
    output
}

fn ensure_trailing_newline(content: &str) -> String {
    if content.ends_with('\n') {
        content.to_string()
    } else {
        format!("{content}\n")
    }
}

fn sanitize_sensitive_content(content: &str) -> String {
    let mut sanitized = content.to_string();
    for key in SENSITIVE_ENV_KEYS {
        if let Ok(secret) = std::env::var(key) {
            if !secret.trim().is_empty() {
                sanitized = sanitized.replace(&secret, "[redacted]");
            }
        }
    }
    sanitized
}

fn write_result_file(results_dir: &str, default_run_id: &str, value: &mut serde_json::Value) -> Result<(PathBuf, String)> {
    let dir = PathBuf::from(results_dir);
    fs::create_dir_all(&dir).with_context(|| format!("Failed to create {}", dir.display()))?;
    let run_id = value
        .get("run_id")
        .and_then(|raw| raw.as_str())
        .filter(|raw| !raw.trim().is_empty())
        .map(|raw| raw.trim().to_string())
        .unwrap_or_else(|| default_run_id.to_string());
    if let Some(object) = value.as_object_mut() {
        object.insert("run_id".to_string(), serde_json::Value::String(run_id.clone()));
    }
    let filename = format!("{}.json", run_id);
    let output_path = dir.join(filename);
    let payload = serde_json::to_string_pretty(value)?;
    fs::write(&output_path, format!("{payload}\n"))
        .with_context(|| format!("Failed to write {}", output_path.display()))?;
    Ok((output_path, run_id))
}

#[derive(Debug, Deserialize)]
struct RegistryScenario {
    id: String,
    #[serde(default = "default_harnesses")]
    harnesses: Vec<String>,
}

fn default_harnesses() -> Vec<String> {
    vec!["base-rt".to_string()]
}

const SCENARIO_IMPL_DIR: &str = "scenarios";

fn load_scenarios_with_harnesses() -> Result<Vec<RegistryScenario>> {
    let repo_root = preflight::resolve_repo_root()?;
    let impl_dir = repo_root.join(SCENARIO_IMPL_DIR);

    let mut scenarios = vec![];

    // Prefer scenarios/*/scenario.json (has harnesses field)
    if impl_dir.exists() {
        for entry in fs::read_dir(&impl_dir)
            .with_context(|| format!("Failed to read {}", impl_dir.display()))?
        {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let scenario_json = path.join("scenario.json");
            if !scenario_json.exists() {
                continue;
            }
            let raw = fs::read_to_string(&scenario_json)
                .with_context(|| format!("Failed to read {}", scenario_json.display()))?;
            let scenario: RegistryScenario = serde_json::from_str(&raw)
                .with_context(|| format!("Invalid scenario JSON: {}", scenario_json.display()))?;
            scenarios.push(scenario);
        }
    }

    // Fall back to registry if no impl dirs found
    if scenarios.is_empty() {
        let registry_dir = preflight::resolve_repo_path(SCENARIO_REGISTRY_DIR)?;
        for entry in fs::read_dir(&registry_dir)
            .with_context(|| format!("Failed to read {}", registry_dir.display()))?
        {
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
    }

    scenarios.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(scenarios)
}

fn build_matrix_jobs(
    scenarios: &[RegistryScenario],
    agent_models: &[(String, String)],
    scenario_filter: Option<&str>,
    harness_filter: Option<&str>,
    persona_filter: &Option<Persona>,
    mode: &PlanMode,
) -> Vec<MatrixJob> {
    let personas: Vec<Persona> = match persona_filter {
        Some(p) => vec![p.clone()],
        None => vec![Persona::Baseline, Persona::Informed],
    };

    let mut jobs = vec![];
    for scenario in scenarios {
        if let Some(filter) = scenario_filter {
            if scenario.id != filter {
                continue;
            }
        }
        for harness in &scenario.harnesses {
            if let Some(filter) = harness_filter {
                if harness != filter {
                    continue;
                }
            }
            for persona in &personas {
                for (agent, model_name) in agent_models {
                    jobs.push(MatrixJob {
                        scenario_id: scenario.id.clone(),
                        harness: harness.clone(),
                        agent: agent.clone(),
                        model: model_name.clone(),
                        persona: persona.clone(),
                        mode: mode.clone(),
                    });
                }
            }
        }
    }
    jobs
}

fn has_existing_result(results_dir: &str, scenario: &str, agent: &str, model: &str, harness: &str, persona: &str) -> Option<String> {
    let dir = Path::new(results_dir);
    let prefix = format!("{}-{}-{}-{}-{}-", scenario, agent, model, harness, persona);

    // Search top-level results dir and one level of subdirectories
    let mut dirs_to_check = vec![dir.to_path_buf()];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                dirs_to_check.push(entry.path());
            }
        }
    }

    for check_dir in dirs_to_check {
        if let Ok(entries) = fs::read_dir(&check_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(&prefix)
                    && name.ends_with(".json")
                    && !name.contains(".assertion-log.")
                    && !name.contains(".agent-raw.")
                    && !name.contains(".run-meta.")
                    && !name.contains(".trace.")
                {
                    return Some(name);
                }
            }
        }
    }

    None
}

fn unix_timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn sanitize_identifier_component(raw: &str) -> String {
    let sanitized: String = raw
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "unknown".to_string()
    } else {
        trimmed.to_string()
    }
}

fn make_run_id(args: &RunArgs, scenario_id: &str, persona: &Persona, mode: &PlanMode) -> String {
    format!(
        "{}-{}-{}-{}-{}-{}-{}",
        sanitize_identifier_component(scenario_id),
        sanitize_identifier_component(&args.agent),
        sanitize_identifier_component(&args.model),
        sanitize_identifier_component(&args.harness),
        persona.as_str(),
        mode.as_str(),
        unix_timestamp_millis()
    )
}

impl Persona {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Baseline => "baseline",
            Self::Informed => "informed",
            Self::MooseUser => "moose-user",
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
        let parsed = extract_result_json(output, "fallback", "base-rt", 0);
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
        let mut payload = serde_json::json!({
            "scenario": "test-scenario",
            "highest_gate": 3
        });

        let default_run_id = "test-scenario-codex-gpt-5.4-base-rt-naive-no-plan-1234";
        let (path, run_id) = write_result_file(
            temp.path().to_str().unwrap_or(""),
            default_run_id,
            &mut payload,
        )
        .expect("write_result_file succeeds");
        let raw = fs::read_to_string(path).expect("result file readable");
        let value: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
        assert_eq!(value["scenario"], "test-scenario");
        assert_eq!(value["highest_gate"], 3);
        assert_eq!(value["run_id"], run_id);
        assert_eq!(run_id, default_run_id);
    }

    #[test]
    fn sanitize_identifier_component_normalizes_unsafe_chars() {
        assert_eq!(
            sanitize_identifier_component("GPT 5.4/Preview"),
            "gpt-5.4-preview"
        );
    }

    #[test]
    fn has_existing_result_finds_matching_file() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(
            temp.path().join("foo-bar-test-codex-gpt-5.4-base-rt-baseline-no-plan-123.json"),
            "{}\n",
        )
        .expect("write file");
        // Sidecar files should not match
        fs::write(
            temp.path().join("foo-bar-test-codex-gpt-5.4-base-rt-baseline-no-plan-123.trace.json"),
            "{}\n",
        )
        .expect("write file");

        let found = has_existing_result(
            temp.path().to_str().unwrap(),
            "foo-bar-test",
            "codex",
            "gpt-5.4",
            "base-rt",
            "baseline",
        );
        assert!(found.is_some());
        assert!(found.unwrap().contains("foo-bar-test-codex-gpt-5.4-base-rt-baseline"));

        // Different persona should not match
        let not_found_persona = has_existing_result(
            temp.path().to_str().unwrap(),
            "foo-bar-test",
            "codex",
            "gpt-5.4",
            "base-rt",
            "informed",
        );
        assert!(not_found_persona.is_none());

        let not_found = has_existing_result(
            temp.path().to_str().unwrap(),
            "foo-bar-test",
            "cursor",
            "composer-2",
            "base-rt",
            "baseline",
        );
        assert!(not_found.is_none());
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

    #[test]
    fn extract_marked_block_uses_line_delimited_markers_and_last_block() {
        let sample = [
            "__DEC_BENCH_AGENT_TRACE_JSON_START__ embedded in agent text",
            "__DEC_BENCH_AGENT_TRACE_JSON_START__",
            "{\"first\":true}",
            "__DEC_BENCH_AGENT_TRACE_JSON_END__",
            "other logs",
            "__DEC_BENCH_AGENT_TRACE_JSON_START__",
            "{\"second\":true}",
            "__DEC_BENCH_AGENT_TRACE_JSON_END__",
        ]
        .join("\n");

        let extracted = extract_marked_block(
            &sample,
            "__DEC_BENCH_AGENT_TRACE_JSON_START__",
            "__DEC_BENCH_AGENT_TRACE_JSON_END__",
        )
        .expect("block should be extracted");
        assert_eq!(extracted, "{\"second\":true}");
    }

    #[test]
    fn strip_marked_block_removes_all_line_delimited_blocks() {
        let sample = [
            "a",
            "__DEC_BENCH_RUN_META_JSON_START__",
            "{\"x\":1}",
            "__DEC_BENCH_RUN_META_JSON_END__",
            "b",
            "__DEC_BENCH_RUN_META_JSON_START__",
            "{\"x\":2}",
            "__DEC_BENCH_RUN_META_JSON_END__",
            "c",
        ]
        .join("\n");

        let stripped = strip_marked_block(
            &sample,
            "__DEC_BENCH_RUN_META_JSON_START__",
            "__DEC_BENCH_RUN_META_JSON_END__",
        );
        assert_eq!(stripped, "a\nb\nc");
    }

    fn make_scenario(id: &str, harnesses: Vec<&str>) -> RegistryScenario {
        RegistryScenario {
            id: id.to_string(),
            harnesses: harnesses.into_iter().map(String::from).collect(),
        }
    }

    fn agent_pair(agent: &str, model: &str) -> (String, String) {
        (agent.to_string(), model.to_string())
    }

    #[test]
    fn matrix_expands_multiple_harnesses() {
        let scenarios = vec![
            make_scenario("single", vec!["base-rt"]),
            make_scenario("multi", vec!["base-rt", "olap-for-swe"]),
        ];
        let agents = vec![agent_pair("claude-code", "sonnet")];
        let jobs = build_matrix_jobs(
            &scenarios,
            &agents,
            None,
            None,
            &Some(Persona::Baseline),
            &PlanMode::NoPlan,
        );
        // single: 1 harness × 1 agent = 1, multi: 2 harnesses × 1 agent = 2
        assert_eq!(jobs.len(), 3);
        assert_eq!(jobs[0].harness, "base-rt");
        assert_eq!(jobs[0].scenario_id, "single");
        assert_eq!(jobs[1].harness, "base-rt");
        assert_eq!(jobs[1].scenario_id, "multi");
        assert_eq!(jobs[2].harness, "olap-for-swe");
        assert_eq!(jobs[2].scenario_id, "multi");
    }

    #[test]
    fn matrix_expands_both_personas_when_none() {
        let scenarios = vec![make_scenario("s1", vec!["base-rt"])];
        let agents = vec![agent_pair("claude-code", "sonnet")];
        let jobs = build_matrix_jobs(
            &scenarios,
            &agents,
            None,
            None,
            &None, // no persona filter → both
            &PlanMode::NoPlan,
        );
        assert_eq!(jobs.len(), 2);
        assert!(matches!(jobs[0].persona, Persona::Baseline));
        assert!(matches!(jobs[1].persona, Persona::Informed));
    }

    #[test]
    fn matrix_filters_persona_when_specified() {
        let scenarios = vec![make_scenario("s1", vec!["base-rt"])];
        let agents = vec![agent_pair("claude-code", "sonnet")];
        let jobs = build_matrix_jobs(
            &scenarios,
            &agents,
            None,
            None,
            &Some(Persona::Informed),
            &PlanMode::NoPlan,
        );
        assert_eq!(jobs.len(), 1);
        assert!(matches!(jobs[0].persona, Persona::Informed));
    }

    #[test]
    fn matrix_filters_by_harness() {
        let scenarios = vec![make_scenario("s1", vec!["base-rt", "olap-for-swe"])];
        let agents = vec![agent_pair("claude-code", "sonnet")];
        let jobs = build_matrix_jobs(
            &scenarios,
            &agents,
            None,
            Some("olap-for-swe"),
            &Some(Persona::Baseline),
            &PlanMode::NoPlan,
        );
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].harness, "olap-for-swe");
    }

    #[test]
    fn matrix_full_expansion() {
        let scenarios = vec![
            make_scenario("s1", vec!["base-rt", "olap-for-swe"]),
            make_scenario("s2", vec!["classic-de"]),
        ];
        let agents = vec![
            agent_pair("claude-code", "sonnet"),
            agent_pair("codex", "gpt-5"),
        ];
        // No persona filter → both personas
        let jobs = build_matrix_jobs(
            &scenarios,
            &agents,
            None,
            None,
            &None,
            &PlanMode::NoPlan,
        );
        // s1: 2 harnesses × 2 personas × 2 agents = 8
        // s2: 1 harness × 2 personas × 2 agents = 4
        assert_eq!(jobs.len(), 12);
    }

    #[test]
    fn sanitize_sensitive_content_redacts_known_env_values() {
        let temp_key = "test-anthropic-secret";
        let temp_openai = "test-openai-secret";
        std::env::set_var("ANTHROPIC_API_KEY", temp_key);
        std::env::set_var("OPENAI_API_KEY", temp_openai);

        let sample = format!(
            "ANTHROPIC_API_KEY={temp_key}\nCODEX_API_KEY={temp_openai}\nplain text"
        );
        let sanitized = sanitize_sensitive_content(&sample);

        assert!(sanitized.contains("ANTHROPIC_API_KEY=[redacted]"));
        assert!(sanitized.contains("CODEX_API_KEY=[redacted]"));
        assert!(!sanitized.contains(temp_key));
        assert!(!sanitized.contains(temp_openai));
    }
}
