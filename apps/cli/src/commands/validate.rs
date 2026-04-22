use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::Args;
use serde::{Deserialize, Serialize};

use super::preflight;

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

const REQUIRED_FILES: [&str; 6] = [
    "scenario.json",
    "supervisord.conf",
    "assertions/functional.ts",
    "assertions/correct.ts",
    "assertions/robust.ts",
    "assertions/performant.ts",
];

const PRODUCTION_ASSERTION: &str = "assertions/production.ts";
const SCAFFOLD_NAIVE_PROMPT: &str = "Describe the task in plain language. No tool names, no implementation hints.";
const SCAFFOLD_SAVVY_PROMPT: &str = "Describe the task with specific tools, targets, and technical constraints";

#[derive(Args, Clone, Debug)]
pub struct ValidateArgs {
    /// Scenario directory path or scenario ID
    #[arg(short, long)]
    pub scenario: String,

    /// Comma-separated competency slugs for registry validation
    #[arg(long)]
    pub competencies: Option<String>,

    /// Comma-separated feature slugs for registry validation
    #[arg(long)]
    pub features: Option<String>,

    /// Scenario starting state for registry validation
    #[arg(long = "starting-state")]
    pub starting_state: Option<String>,

    /// Comma-separated service names for registry validation
    #[arg(long)]
    pub services: Option<String>,

    /// Output format
    #[arg(long, value_enum, default_value = "table")]
    pub format: OutputFormat,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum OutputFormat {
    Table,
    Json,
}

#[derive(Debug, Deserialize)]
struct ScenarioTask {
    id: Option<String>,
    description: Option<String>,
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScenarioInfrastructure {
    services: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ScenarioJson {
    id: String,
    title: String,
    description: String,
    tier: String,
    domain: String,
    harnesses: Vec<String>,
    tasks: Vec<ScenarioTask>,
    infrastructure: Option<ScenarioInfrastructure>,
}

#[derive(Debug, Serialize)]
struct ValidationReport {
    scenario_id: String,
    scenario_dir: String,
    passed: bool,
    registry_ready: bool,
    errors: Vec<String>,
    warnings: Vec<String>,
}

pub async fn execute(args: ValidateArgs) -> Result<()> {
    let report = validate(&args)?;

    match args.format {
        OutputFormat::Table => print_table(&report),
        OutputFormat::Json => print_json(&report)?,
    }

    if !report.passed {
        bail!("Validation failed for {}", report.scenario_id);
    }

    Ok(())
}

fn validate(args: &ValidateArgs) -> Result<ValidationReport> {
    let scenario_dir = resolve_scenario_dir(&args.scenario)?;
    let repo_root = preflight::resolve_repo_root()?;
    validate_with_repo_root(&repo_root, &scenario_dir, args)
}

#[cfg(test)]
fn validate_at_dir(scenario_dir: &Path, args: &ValidateArgs) -> Result<ValidationReport> {
    let mut path = scenario_dir;
    let repo_root = loop {
        if path.join(".git").exists() {
            break path.to_path_buf();
        }
        match path.parent() {
            Some(parent) => path = parent,
            None => bail!("Could not locate repository root from {}", scenario_dir.display()),
        }
    };
    validate_with_repo_root(&repo_root, scenario_dir, args)
}

fn validate_with_repo_root(
    repo_root: &Path,
    scenario_dir: &Path,
    args: &ValidateArgs,
) -> Result<ValidationReport> {
    let scenario_json_path = scenario_dir.join("scenario.json");
    let raw = fs::read_to_string(&scenario_json_path)
        .with_context(|| format!("Failed to read {}", scenario_json_path.display()))?;
    let scenario: ScenarioJson = serde_json::from_str(&raw)
        .with_context(|| format!("Invalid JSON in {}", scenario_json_path.display()))?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for rel in REQUIRED_FILES {
        let path = scenario_dir.join(rel);
        if !path.exists() {
            errors.push(format!("Missing required scenario file: {}", path.display()));
        }
    }
    let production_assertion_path = scenario_dir.join(PRODUCTION_ASSERTION);
    if !production_assertion_path.exists() {
        errors.push(format!(
            "Missing required scenario file: {}",
            production_assertion_path.display()
        ));
    }

    let dir_name = scenario_dir
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();
    if scenario.id.trim().is_empty() {
        errors.push("`scenario.json` is missing a non-empty `id`.".to_string());
    } else if !dir_name.is_empty() && scenario.id != dir_name {
        errors.push(format!(
            "`scenario.json` id '{}' does not match directory name '{}'.",
            scenario.id, dir_name
        ));
    }
    if scenario.title.trim().is_empty() {
        errors.push("`scenario.json` must include a non-empty `title`.".to_string());
    }
    if scenario.description.trim().is_empty() {
        errors.push("`scenario.json` must include a non-empty `description`.".to_string());
    }
    if scenario.tier.trim().is_empty() {
        errors.push("`scenario.json` must include a non-empty `tier`.".to_string());
    }
    if scenario.domain.trim().is_empty() {
        errors.push("`scenario.json` must include a non-empty `domain`.".to_string());
    }
    if scenario.harnesses.is_empty() {
        errors.push("`scenario.json` must include a non-empty `harnesses` array.".to_string());
    }

    if scenario.tasks.is_empty() {
        errors.push("`scenario.json` should define at least one task.".to_string());
    } else {
        for (idx, task) in scenario.tasks.iter().enumerate() {
            if task.id.as_deref().unwrap_or("").trim().is_empty() {
                errors.push(format!("Task {} is missing a non-empty `id`.", idx + 1));
            }
            if task.description.as_deref().unwrap_or("").trim().is_empty() {
                errors.push(format!(
                    "Task {} is missing a non-empty `description`.",
                    idx + 1
                ));
            }
            if task.category.as_deref().unwrap_or("").trim().is_empty() {
                errors.push(format!("Task {} is missing a non-empty `category`.", idx + 1));
            }
        }
    }

    // Each declared harness must own its prompts at harnesses/{harness}/prompts/.
    for harness in &scenario.harnesses {
        validate_harness_prompts(
            &scenario_dir,
            harness,
            &mut errors,
            &mut warnings,
        );
    }

    validate_assertion_file(
        &scenario_dir.join("assertions/functional.ts"),
        "functional",
        &mut warnings,
    );
    validate_assertion_file(
        &scenario_dir.join("assertions/correct.ts"),
        "correct",
        &mut warnings,
    );
    validate_assertion_file(
        &scenario_dir.join("assertions/robust.ts"),
        "robust",
        &mut warnings,
    );
    validate_assertion_file(
        &scenario_dir.join("assertions/performant.ts"),
        "performant",
        &mut warnings,
    );
    validate_assertion_file(
        &scenario_dir.join("assertions/production.ts"),
        "production",
        &mut warnings,
    );

    validate_supervisord(&scenario_dir.join("supervisord.conf"), &mut warnings);
    validate_init_dir(
        &scenario_dir.join("init"),
        &mut errors,
        &mut warnings,
    );
    validate_harnesses_dir(
        &scenario_dir.join("harnesses"),
        &scenario.harnesses,
        &mut warnings,
    );
    for harness in &scenario.harnesses {
        validate_harness(&repo_root, harness, &mut warnings);
    }

    let registry_ready = validate_registry_inputs(
        &scenario,
        args,
        errors.as_mut(),
        warnings.as_mut(),
    )?;

    Ok(ValidationReport {
        scenario_id: scenario.id,
        scenario_dir: scenario_dir.display().to_string(),
        passed: errors.is_empty(),
        registry_ready: errors.is_empty() && registry_ready,
        errors,
        warnings,
    })
}

fn print_table(report: &ValidationReport) {
    let status = if report.passed { "passed" } else { "failed" };
    let registry = if report.registry_ready { "yes" } else { "no" };

    println!(
        "Validation {} for {}",
        status,
        report.scenario_id
    );
    println!("Scenario directory: {}", report.scenario_dir);
    println!("Registry ready: {}", registry);

    if !report.errors.is_empty() {
        println!();
        println!("Errors:");
        for error in &report.errors {
            println!("  - {}", error);
        }
    }

    if !report.warnings.is_empty() {
        println!();
        println!("Warnings:");
        for warning in &report.warnings {
            println!("  - {}", warning);
        }
    }
}

fn print_json(report: &ValidationReport) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(report)?);
    Ok(())
}

fn resolve_scenario_dir(input: &str) -> Result<PathBuf> {
    let raw = PathBuf::from(input);
    if raw.is_dir() {
        return Ok(raw);
    }

    let repo_root = preflight::resolve_repo_root()?;
    let candidate = repo_root.join("scenarios").join(input);
    if candidate.is_dir() {
        return Ok(candidate);
    }

    bail!(
        "Scenario directory not found. Tried '{}' and '{}'",
        raw.display(),
        candidate.display()
    )
}

fn validate_harness_prompts(
    scenario_dir: &Path,
    harness: &str,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let prompts_dir = scenario_dir.join("harnesses").join(harness).join("prompts");
    for (persona, scaffold_hint) in &[
        ("baseline", SCAFFOLD_NAIVE_PROMPT),
        ("informed", SCAFFOLD_SAVVY_PROMPT),
    ] {
        let path = prompts_dir.join(format!("{persona}.md"));
        if !path.exists() {
            errors.push(format!(
                "Missing prompt file for harness `{harness}`: harnesses/{harness}/prompts/{persona}.md"
            ));
            continue;
        }
        let content = fs::read_to_string(&path).unwrap_or_default();
        if content.trim().is_empty() {
            errors.push(format!(
                "Prompt file is empty: harnesses/{harness}/prompts/{persona}.md"
            ));
        } else if content.contains(scaffold_hint) {
            warnings.push(format!(
                "harnesses/{harness}/prompts/{persona}.md still contains the scaffold placeholder text."
            ));
        }
    }
}

fn validate_assertion_file(path: &Path, gate: &str, warnings: &mut Vec<String>) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    if content.contains("TODO: implement") || content.contains("example_check") {
        warnings.push(format!(
            "`{}` assertion appears to still contain scaffold placeholder logic.",
            gate
        ));
    }
}

fn validate_supervisord(path: &Path, warnings: &mut Vec<String>) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    if content.trim().is_empty() {
        warnings.push("`supervisord.conf` is empty.".to_string());
    } else if content.contains("Add additional services below") {
        warnings.push("`supervisord.conf` still contains the scaffold comment.".to_string());
    }
}

fn validate_init_dir(
    path: &Path,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    if !path.is_dir() {
        errors.push(format!("Init directory not found: {}", path.display()));
        return;
    }

    let file_count = fs::read_dir(path)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .count();

    if file_count == 0 {
        warnings.push(format!(
            "Flat init/ directory has no files. All seed data for this scenario is harness-specific."
        ));
    }

    let _ = warnings; // suppress unused warning if caller adds more checks
}

fn validate_harnesses_dir(
    harnesses_path: &Path,
    declared_harnesses: &[String],
    warnings: &mut Vec<String>,
) {
    if !harnesses_path.is_dir() {
        return; // harnesses/ is optional (only needed when per-harness overrides exist)
    }

    let Ok(entries) = fs::read_dir(harnesses_path) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }
        let subdir_name = entry_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if !declared_harnesses.iter().any(|h| h == &subdir_name) {
            warnings.push(format!(
                "harnesses/{subdir_name}/ does not match any harness in `harnesses[]` and will never be used."
            ));
        }
    }
}

fn validate_harness(repo_root: &Path, harness: &str, warnings: &mut Vec<String>) {
    let harness_json = repo_root
        .join("apps/web/data/harnesses")
        .join(format!("{}.json", harness));
    if !harness_json.exists() {
        warnings.push(format!(
            "Harness '{}' is not present in apps/web/data/harnesses.",
            harness
        ));
    }
}

fn validate_registry_inputs(
    scenario: &ScenarioJson,
    args: &ValidateArgs,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) -> Result<bool> {
    let (Some(competencies_raw), Some(features_raw), Some(starting_state), Some(services_raw)) = (
        args.competencies.as_deref(),
        args.features.as_deref(),
        args.starting_state.as_deref(),
        args.services.as_deref(),
    ) else {
        warnings.push(
            "Registry readiness was not fully validated. Supply --competencies, --features, --starting-state, and --services.".to_string(),
        );
        return Ok(false);
    };

    let competencies = parse_csv(competencies_raw);
    let features = parse_csv(features_raw);
    let services = parse_csv(services_raw);

    validate_allowed("competency", &competencies, &COMPETENCY_SLUGS, errors);
    validate_allowed("feature", &features, &FEATURE_SLUGS, errors);
    validate_starting_state(starting_state, errors);

    if services.is_empty() {
        errors.push("`--services` must include at least one service.".to_string());
    }

    let scenario_services = scenario
        .infrastructure
        .as_ref()
        .and_then(|infra| infra.services.clone())
        .unwrap_or_default();
    if !scenario_services.is_empty() && scenario_services != services {
        warnings.push(format!(
            "Registry services {:?} do not match scenario infrastructure services {:?}.",
            services, scenario_services
        ));
    }

    Ok(errors.is_empty())
}

fn parse_csv(input: &str) -> Vec<String> {
    input
        .split(',')
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(|item| item.to_string())
        .collect()
}

fn validate_allowed(label: &str, values: &[String], allowed: &[&str], errors: &mut Vec<String>) {
    for value in values {
        if !allowed.contains(&value.as_str()) {
            errors.push(format!(
                "Invalid {} '{}'. Allowed values: {}",
                label,
                value,
                allowed.join(", ")
            ));
        }
    }
}

fn validate_starting_state(value: &str, errors: &mut Vec<String>) {
    if !matches!(value, "broken" | "greenfield") {
        errors.push(format!(
            "Invalid --starting-state '{}'. Expected broken or greenfield.",
            value
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_file(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent dir");
        }
        fs::write(path, content).expect("write file");
    }

    fn seed_valid_scenario(root: &Path) {
        fs::create_dir_all(root.join(".git")).expect("git dir");
        let scenario_dir = root.join("scenarios/test-scenario");
        fs::create_dir_all(scenario_dir.join("assertions")).expect("assertions");
        fs::create_dir_all(scenario_dir.join("harnesses/base-rt/prompts")).expect("harness prompts");
        fs::create_dir_all(scenario_dir.join("init")).expect("init");
        fs::create_dir_all(root.join("apps/web/data/harnesses")).expect("harness dir");

        write_file(
            &scenario_dir.join("scenario.json"),
            r#"{
  "id": "test-scenario",
  "title": "Test Scenario",
  "description": "A valid test scenario.",
  "tier": "tier-1",
  "domain": "foo-bar",
  "harnesses": ["base-rt"],
  "tasks": [{"id":"task-1","description":"Do the thing","category":"ingestion"}],
  "infrastructure": {"services": ["clickhouse"]}
}"#,
        );
        write_file(&scenario_dir.join("harnesses/base-rt/prompts/baseline.md"), "Do the task.\n");
        write_file(&scenario_dir.join("harnesses/base-rt/prompts/informed.md"), "Use ClickHouse.\n");
        write_file(&scenario_dir.join("supervisord.conf"), "[program:clickhouse]\n");
        write_file(&scenario_dir.join("init/setup.sh"), "#!/usr/bin/env bash\n");
        for gate in ["functional", "correct", "robust", "performant", "production"] {
            write_file(
                &scenario_dir.join(format!("assertions/{gate}.ts")),
                "export async function check() { return true; }\n",
            );
        }
        write_file(
            &root.join("apps/web/data/harnesses/base-rt.json"),
            "{}\n",
        );
    }

    #[test]
    fn validate_accepts_existing_valid_scenario_and_registry_inputs() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: Some("data-ingestion-and-integration".to_string()),
            features: Some(String::new()),
            starting_state: Some("greenfield".to_string()),
            services: Some("clickhouse".to_string()),
            format: OutputFormat::Table,
        };
        let report =
            validate_at_dir(&temp.path().join("scenarios/test-scenario"), &args).expect("validate");

        assert!(report.passed);
        assert!(report.registry_ready);
        assert!(report.errors.is_empty());
    }

    #[test]
    fn validate_warns_when_registry_inputs_are_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report =
            validate_at_dir(&temp.path().join("scenarios/test-scenario"), &args).expect("validate");

        assert!(report.passed);
        assert!(!report.registry_ready);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("Registry readiness was not fully validated")));
    }

    #[test]
    fn validate_accepts_multi_harness_scenario_with_harness_prompts() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        write_file(
            &scenario_dir.join("scenario.json"),
            r#"{
  "id": "test-scenario",
  "title": "Test Scenario",
  "description": "Multi-harness test scenario.",
  "tier": "tier-1",
  "domain": "foo-bar",
  "harnesses": ["base-rt", "olap-for-swe"],
  "tasks": [{"id":"task-1","description":"Do the thing","category":"ingestion"}],
  "infrastructure": {"services": ["clickhouse"]}
}"#,
        );
        write_file(&temp.path().join("apps/web/data/harnesses/olap-for-swe.json"), "{}\n");
        write_file(&scenario_dir.join("harnesses/olap-for-swe/prompts/baseline.md"), "Do the task.\n");
        write_file(&scenario_dir.join("harnesses/olap-for-swe/prompts/informed.md"), "Use Moose.\n");
        write_file(&scenario_dir.join("harnesses/olap-for-swe/init/seed-workspace.sh"), "#!/usr/bin/env bash\n");

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report = validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "errors: {:?}", report.errors);
        assert!(!report.warnings.iter().any(|w| w.contains("does not match any harness")));
    }

    #[test]
    fn validate_errors_when_harness_prompt_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Remove informed.md from the only harness.
        fs::remove_file(scenario_dir.join("harnesses/base-rt/prompts/informed.md"))
            .expect("remove informed.md");

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report = validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(!report.passed);
        assert!(report.errors.iter().any(|e| e.contains("harnesses/base-rt/prompts/informed.md")));
    }

    #[test]
    fn validate_warns_when_harnesses_dir_contains_unknown_harness() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Create a harnesses/ subdir that isn't declared in scenario.json.
        write_file(&scenario_dir.join("harnesses/not-a-harness/prompts/baseline.md"), "x\n");

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report = validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "should pass; unknown harness dir is a warning");
        assert!(report.warnings.iter().any(|w| w.contains("not-a-harness") && w.contains("will never be used")));
    }

    #[test]
    fn validate_warns_on_scaffold_placeholder_in_prompt() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Overwrite baseline.md with scaffold placeholder text.
        write_file(
            &scenario_dir.join("harnesses/base-rt/prompts/baseline.md"),
            "<!-- [base-rt] Describe the task in plain language. No tool names, no implementation hints. -->\n",
        );

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report = validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "placeholder prompt is a warning not an error");
        assert!(report.warnings.iter().any(|w| w.contains("baseline.md") && w.contains("scaffold placeholder")));
    }
}
