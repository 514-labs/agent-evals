use std::fs;
use std::io::{self, IsTerminal, Write};
use std::path::{Path, PathBuf};
#[cfg(feature = "up-next")]
use std::process::Command;

use anyhow::{bail, Context, Result};
use clap::{Args, Subcommand, ValueEnum};
use serde::Deserialize;

use super::preflight;

const SCENARIO_OUTPUT_DIR: &str = "apps/web/data/scenarios";
const HARNESS_OUTPUT_DIR: &str = "apps/web/data/harnesses";

const COMPETENCY_SLUGS: [&str; 12] = [
    "environment-setup",
    "data-modeling-and-schema-design",
    "data-ingestion-and-integration",
    "transformation-and-semantic-modeling",
    "storage-and-data-layout",
    "orchestration-and-dataops",
    "data-quality-and-observability",
    "reliability-and-fault-tolerance",
    "distributed-systems-and-consistency",
    "scalability-and-performance-engineering",
    "security-privacy-and-governance",
    "technology-selection-and-architecture-tradeoffs",
];

const FEATURE_SLUGS: [&str; 5] = [
    "performance-dashboards",
    "reporting-metrics-layers",
    "exported-reports",
    "realtime-feeds",
    "analytical-chat",
];

#[derive(Args)]
pub struct RegistryArgs {
    #[command(subcommand)]
    pub command: RegistryCommand,
}

#[derive(Subcommand)]
pub enum RegistryCommand {
    /// Add a scenario or harness entry to the docs registry
    Add(AddArgs),
    #[cfg(feature = "up-next")]
    /// Publish a registry entry by opening a GitHub PR
    Publish(PublishArgs),
}

#[derive(ValueEnum, Clone, Debug)]
pub enum RegistryEntryType {
    Scenario,
    Harness,
}

#[derive(ValueEnum, Clone, Debug)]
pub enum NetworkPolicy {
    Open,
    Restricted,
}

impl std::fmt::Display for NetworkPolicy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Open => write!(f, "open"),
            Self::Restricted => write!(f, "restricted"),
        }
    }
}

#[derive(Args)]
pub struct AddArgs {
    /// Entry type to add
    #[arg(long = "type", value_enum, default_value = "scenario")]
    pub entry_type: RegistryEntryType,

    /// Path to scenario directory (required for scenario entries)
    #[arg(long)]
    pub scenario: Option<PathBuf>,

    /// Comma-separated competency slugs
    #[arg(long)]
    pub competencies: Option<String>,

    /// Comma-separated feature slugs
    #[arg(long)]
    pub features: Option<String>,

    /// Scenario starting state (broken or greenfield)
    #[arg(long = "starting-state")]
    pub starting_state: Option<String>,

    /// Comma-separated service names (postgres,clickhouse,redpanda,...)
    #[arg(long)]
    pub services: Option<String>,

    /// Optional output directory override
    #[arg(long)]
    pub out: Option<PathBuf>,

    /// Harness ID (required for harness entries)
    #[arg(long)]
    pub id: Option<String>,

    /// Harness title (required for harness entries)
    #[arg(long)]
    pub title: Option<String>,

    /// Harness description (required for harness entries)
    #[arg(long)]
    pub description: Option<String>,

    /// Shell script body run at build-time to install harness tooling
    #[arg(long)]
    pub install_script: Option<String>,

    /// Harness network policy
    #[arg(long = "network-policy", value_enum, default_value = "open")]
    pub network_policy: NetworkPolicy,

    /// Comma-separated endpoint allowlist for harness entries
    #[arg(long = "allowlisted-endpoints")]
    pub allowlisted_endpoints: Option<String>,
}

#[cfg(feature = "up-next")]
#[derive(Args)]
pub struct PublishArgs {
    /// Registry entry ID to publish
    #[arg(long)]
    pub id: String,

    /// Base branch for PR creation
    #[arg(long, default_value = "main")]
    pub base: String,

    /// Open the PR as a draft
    #[arg(long)]
    pub draft: bool,
}

#[derive(Deserialize)]
struct ScenarioJson {
    id: String,
    title: String,
    description: String,
    tier: String,
    domain: String,
    harness: Option<String>,
    tasks: Option<Vec<ScenarioTask>>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct ScenarioTask {
    category: Option<String>,
}

pub async fn execute(args: RegistryArgs) -> Result<()> {
    match args.command {
        RegistryCommand::Add(add_args) => execute_add(add_args),
        #[cfg(feature = "up-next")]
        RegistryCommand::Publish(publish_args) => execute_publish(publish_args),
    }
}

fn execute_add(args: AddArgs) -> Result<()> {
    match args.entry_type {
        RegistryEntryType::Scenario => add_scenario(args),
        RegistryEntryType::Harness => add_harness(args),
    }
}

fn add_scenario(args: AddArgs) -> Result<()> {
    let scenario_dir = args
        .scenario
        .clone()
        .context("--scenario is required when --type scenario")?;

    validate_scenario_dir(&scenario_dir)?;

    let scenario_json_path = scenario_dir.join("scenario.json");
    let raw = fs::read_to_string(&scenario_json_path)
        .with_context(|| format!("Failed to read {}", scenario_json_path.display()))?;
    let scenario_json: ScenarioJson = serde_json::from_str(&raw)
        .with_context(|| format!("Invalid JSON in {}", scenario_json_path.display()))?;

    let stdin_is_tty = io::stdin().is_terminal();

    let competencies_raw = match args.competencies {
        Some(value) => value,
        None if stdin_is_tty => prompt("Competencies (comma-separated slugs)")?,
        None => bail!("Missing --competencies (or run in interactive terminal)"),
    };
    let features_raw = match args.features {
        Some(value) => value,
        None if stdin_is_tty => prompt("Features (comma-separated slugs)")?,
        None => bail!("Missing --features (or run in interactive terminal)"),
    };
    let starting_state = match args.starting_state {
        Some(value) => value,
        None if stdin_is_tty => prompt("Starting state (broken|greenfield)")?,
        None => bail!("Missing --starting-state (or run in interactive terminal)"),
    };
    let services_raw = match args.services {
        Some(value) => value,
        None if stdin_is_tty => prompt("Services (comma-separated, e.g. postgres,clickhouse)")?,
        None => bail!("Missing --services (or run in interactive terminal)"),
    };

    let competencies = parse_csv(&competencies_raw);
    let features = parse_csv(&features_raw);
    let services = parse_csv(&services_raw);

    validate_allowed("competency", &competencies, &COMPETENCY_SLUGS)?;
    validate_allowed("feature", &features, &FEATURE_SLUGS)?;
    validate_starting_state(&starting_state)?;

    let tasks = scenario_json.tasks.unwrap_or_default();
    let task_categories: Vec<String> = tasks
        .iter()
        .filter_map(|task| task.category.clone())
        .collect();
    let task_count = tasks.len();
    let tags = scenario_json.tags.unwrap_or_default();
    let harnesses = scenario_json
        .harness
        .map(|h| vec![h])
        .unwrap_or_else(|| vec!["base-rt".to_string()]);

    let out_dir = match args.out {
        Some(path) => path,
        None => preflight::resolve_repo_path(SCENARIO_OUTPUT_DIR)?,
    };
    fs::create_dir_all(&out_dir)
        .with_context(|| format!("Failed to create {}", out_dir.display()))?;

    let output_path = out_dir.join(format!("{}.json", scenario_json.id));
    if output_path.exists() {
        bail!("Registry entry already exists: {}", output_path.display());
    }

    let entry = serde_json::json!({
        "id": scenario_json.id,
        "title": scenario_json.title,
        "description": scenario_json.description,
        "tier": scenario_json.tier,
        "domain": scenario_json.domain,
        "startingState": starting_state,
        "competencies": competencies,
        "features": features,
        "taskCategories": task_categories,
        "harnesses": harnesses,
        "taskCount": task_count,
        "services": services,
        "tags": tags,
    });

    fs::write(&output_path, format!("{}\n", serde_json::to_string_pretty(&entry)?))
        .with_context(|| format!("Failed to write {}", output_path.display()))?;

    println!("Created scenario registry entry: {}", output_path.display());
    println!("Available competencies:");
    println!("  {}", COMPETENCY_SLUGS.join(", "));
    println!("Available features:");
    println!("  {}", FEATURE_SLUGS.join(", "));
    println!();
    println!("Next step:");
    println!("  dec-bench registry publish --id {}", entry["id"].as_str().unwrap_or(""));

    Ok(())
}

fn add_harness(args: AddArgs) -> Result<()> {
    let stdin_is_tty = io::stdin().is_terminal();

    let id = required_value(args.id, stdin_is_tty, "Harness ID (--id)")?;
    let title = required_value(args.title, stdin_is_tty, "Harness title (--title)")?;
    let description = required_value(
        args.description,
        stdin_is_tty,
        "Harness description (--description)",
    )?;
    let install_script = required_value(
        args.install_script,
        stdin_is_tty,
        "Install script (--install-script)",
    )?;
    let allowlisted_endpoints = args
        .allowlisted_endpoints
        .map(|v| parse_csv(&v))
        .unwrap_or_default();

    let out_dir = match args.out {
        Some(path) => path,
        None => preflight::resolve_repo_path(HARNESS_OUTPUT_DIR)?,
    };
    fs::create_dir_all(&out_dir)
        .with_context(|| format!("Failed to create {}", out_dir.display()))?;

    let output_path = out_dir.join(format!("{id}.json"));
    if output_path.exists() {
        bail!("Registry entry already exists: {}", output_path.display());
    }

    let entry = serde_json::json!({
        "id": id,
        "title": title,
        "description": description,
        "installScript": install_script,
        "networkPolicy": args.network_policy.to_string(),
        "allowlistedEndpoints": allowlisted_endpoints,
    });

    fs::write(&output_path, format!("{}\n", serde_json::to_string_pretty(&entry)?))
        .with_context(|| format!("Failed to write {}", output_path.display()))?;

    println!("Created harness registry entry: {}", output_path.display());
    println!();
    println!("Next step:");
    println!(
        "  dec-bench registry publish --id {}",
        entry["id"].as_str().unwrap_or("")
    );

    Ok(())
}

#[cfg(feature = "up-next")]
fn execute_publish(args: PublishArgs) -> Result<()> {
    run_checked("gh", &["--version"])?;
    run_checked("gh", &["auth", "status"])?;

    let scenario_file = preflight::resolve_repo_path(&format!("{SCENARIO_OUTPUT_DIR}/{}.json", args.id))?;
    let harness_file = preflight::resolve_repo_path(&format!("{HARNESS_OUTPUT_DIR}/{}.json", args.id))?;

    let mut files_to_stage: Vec<PathBuf> = vec![];
    let mut entry_kind = "entry";
    if scenario_file.exists() {
        files_to_stage.push(scenario_file);
        entry_kind = "scenario";
    }
    if harness_file.exists() {
        files_to_stage.push(harness_file);
        entry_kind = "harness";
    }

    if files_to_stage.is_empty() {
        bail!(
            "No registry file found for id '{}'. Expected {} or {}",
            args.id,
            PathBuf::from(format!("{SCENARIO_OUTPUT_DIR}/<id>.json")).display(),
            PathBuf::from(format!("{HARNESS_OUTPUT_DIR}/<id>.json")).display()
        );
    }

    let branch = format!("registry/add-{}", args.id);
    if run_checked("git", &["checkout", "-b", &branch]).is_err() {
        run_checked("git", &["checkout", &branch])?;
    }

    let files: Vec<String> = files_to_stage
        .iter()
        .map(|file| file.to_string_lossy().to_string())
        .collect();
    let mut add_args = vec!["add".to_string()];
    add_args.extend(files.clone());
    let add_refs: Vec<&str> = add_args.iter().map(|v| v.as_str()).collect();
    run_checked("git", &add_refs)?;

    let commit_message = format!("registry: add {} {}", args.id, entry_kind);
    run_checked("git", &["commit", "-m", &commit_message])?;
    run_checked("git", &["push", "-u", "origin", &branch])?;

    let title = format!("Registry: add {}", args.id);
    let body = format!(
        "## Summary\n- Add registry entry `{}`\n- Entry type: {}\n- Generated via `dec-bench registry publish`\n",
        args.id, entry_kind
    );
    let mut pr_args = vec![
        "pr",
        "create",
        "--base",
        args.base.as_str(),
        "--head",
        branch.as_str(),
        "--title",
        title.as_str(),
        "--body",
        body.as_str(),
    ];
    if args.draft {
        pr_args.push("--draft");
    }

    let output = run_checked_capture("gh", &pr_args)?;
    let pr_url = output.trim();
    println!("Opened PR: {}", pr_url);

    Ok(())
}

fn validate_scenario_dir(dir: &Path) -> Result<()> {
    if !dir.is_dir() {
        bail!("Scenario directory not found: {}", dir.display());
    }

    let required = [
        "scenario.json",
        "supervisord.conf",
        "prompts/naive.md",
        "prompts/savvy.md",
        "assertions/functional.ts",
        "assertions/correct.ts",
        "assertions/robust.ts",
        "assertions/performant.ts",
        "assertions/production.ts",
    ];

    for rel in required {
        let path = dir.join(rel);
        if !path.exists() {
            bail!("Missing required scenario file: {}", path.display());
        }
    }

    Ok(())
}

fn parse_csv(input: &str) -> Vec<String> {
    input
        .split(',')
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .collect()
}

fn validate_allowed(label: &str, values: &[String], allowed: &[&str]) -> Result<()> {
    for value in values {
        if !allowed.contains(&value.as_str()) {
            bail!(
                "Invalid {} '{}'. Allowed values: {}",
                label,
                value,
                allowed.join(", ")
            );
        }
    }
    Ok(())
}

fn validate_starting_state(value: &str) -> Result<()> {
    match value {
        "broken" | "greenfield" => Ok(()),
        _ => bail!("Invalid --starting-state '{}'. Expected broken or greenfield", value),
    }
}

fn required_value(value: Option<String>, stdin_is_tty: bool, prompt_label: &str) -> Result<String> {
    match value {
        Some(v) => Ok(v),
        None if stdin_is_tty => prompt(prompt_label),
        None => bail!("Missing required value: {}", prompt_label),
    }
}

fn prompt(label: &str) -> Result<String> {
    print!("{label}: ");
    io::stdout().flush().context("Failed to flush stdout")?;

    let mut buffer = String::new();
    io::stdin()
        .read_line(&mut buffer)
        .context("Failed to read input")?;

    let value = buffer.trim().to_string();
    if value.is_empty() {
        bail!("Prompt value cannot be empty");
    }
    Ok(value)
}

#[cfg(feature = "up-next")]
fn run_checked(command: &str, args: &[&str]) -> Result<()> {
    let status = Command::new(command)
        .args(args)
        .status()
        .with_context(|| format!("Failed to run: {} {}", command, args.join(" ")))?;

    if !status.success() {
        bail!("Command failed: {} {}", command, args.join(" "));
    }
    Ok(())
}

#[cfg(feature = "up-next")]
fn run_checked_capture(command: &str, args: &[&str]) -> Result<String> {
    let output = Command::new(command)
        .args(args)
        .output()
        .with_context(|| format!("Failed to run: {} {}", command, args.join(" ")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        bail!("Command failed: {} {}\n{}", command, args.join(" "), stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parse_csv_trims_and_skips_empty_values() {
        let parsed = parse_csv(" a, ,b ,, c ");
        assert_eq!(
            parsed,
            vec!["a".to_string(), "b".to_string(), "c".to_string()]
        );
    }

    #[test]
    fn validate_starting_state_accepts_expected_values() {
        assert!(validate_starting_state("broken").is_ok());
        assert!(validate_starting_state("greenfield").is_ok());
        assert!(validate_starting_state("invalid").is_err());
    }

    #[test]
    fn add_harness_writes_registry_file() {
        let temp = tempfile::tempdir().expect("temp dir");
        let args = AddArgs {
            entry_type: RegistryEntryType::Harness,
            scenario: None,
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            out: Some(temp.path().to_path_buf()),
            id: Some("test-harness".to_string()),
            title: Some("Test Harness".to_string()),
            description: Some("Harness for tests".to_string()),
            install_script: Some("pip3 install --no-cache-dir dbt-core==1.10.19 dbt-postgres==1.10.0".to_string()),
            network_policy: NetworkPolicy::Restricted,
            allowlisted_endpoints: Some("pypi.org,registry.npmjs.org".to_string()),
        };

        add_harness(args).expect("add_harness succeeds");
        let out_file = temp.path().join("test-harness.json");
        assert!(out_file.exists());
        let payload = fs::read_to_string(out_file).expect("read output");
        let json: serde_json::Value = serde_json::from_str(&payload).expect("valid json");
        assert_eq!(json["id"], "test-harness");
        assert_eq!(json["networkPolicy"], "restricted");
        assert_eq!(
            json["installScript"],
            "pip3 install --no-cache-dir dbt-core==1.10.19 dbt-postgres==1.10.0"
        );
    }
}
