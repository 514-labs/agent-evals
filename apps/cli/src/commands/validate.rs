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

const REQUIRED_FILES: [&str; 8] = [
    "scenario.json",
    "supervisord.conf",
    "prompts/baseline.md",
    "prompts/informed.md",
    "assertions/functional.ts",
    "assertions/correct.ts",
    "assertions/robust.ts",
    "assertions/performant.ts",
];

const PRODUCTION_ASSERTION: &str = "assertions/production.ts";
const SCAFFOLD_NAIVE_PROMPT: &str =
    "<!-- Describe the task in plain language. No tool names, no implementation hints. -->";
const SCAFFOLD_SAVVY_PROMPT: &str =
    "<!-- Describe the task with specific tools, targets, and technical constraints. -->";

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
    #[serde(rename = "personaPrompts")]
    persona_prompts: Option<std::collections::BTreeMap<String, String>>,
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

    let persona_prompts = scenario.persona_prompts.clone().unwrap_or_default();
    validate_prompt(
        &scenario_dir,
        &persona_prompts,
        "baseline",
        SCAFFOLD_NAIVE_PROMPT,
        &mut errors,
        &mut warnings,
    );
    validate_prompt(
        &scenario_dir,
        &persona_prompts,
        "informed",
        SCAFFOLD_SAVVY_PROMPT,
        &mut errors,
        &mut warnings,
    );

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
        &scenario.harnesses,
        &mut errors,
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

fn validate_prompt(
    scenario_dir: &Path,
    persona_prompts: &std::collections::BTreeMap<String, String>,
    persona: &str,
    scaffold_placeholder: &str,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let Some(rel_path) = persona_prompts.get(persona) else {
        errors.push(format!(
            "`scenario.json` must include a `{}` prompt path in `personaPrompts`.",
            persona
        ));
        return;
    };

    let prompt_path = scenario_dir.join(rel_path);
    if !prompt_path.exists() {
        errors.push(format!(
            "Referenced `{}` prompt file does not exist: {}",
            persona,
            prompt_path.display()
        ));
        return;
    }

    let content = fs::read_to_string(&prompt_path).unwrap_or_default();
    if content.trim().is_empty() {
        errors.push(format!("`{}` prompt file is empty.", persona));
    } else if content.trim() == scaffold_placeholder {
        warnings.push(format!(
            "`{}` prompt still contains the scaffold placeholder text.",
            persona
        ));
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
    declared_harnesses: &[String],
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    if !path.is_dir() {
        errors.push(format!("Init directory not found: {}", path.display()));
        return;
    }

    let entries: Vec<_> = match fs::read_dir(path) {
        Ok(rd) => rd.filter_map(|entry| entry.ok()).collect(),
        Err(_) => {
            errors.push(format!("Cannot read init directory: {}", path.display()));
            return;
        }
    };

    let mut total_files: usize = 0;

    for entry in &entries {
        let entry_path = entry.path();
        if entry_path.is_file() {
            total_files += 1;
            continue;
        }
        if !entry_path.is_dir() {
            continue;
        }

        let subdir_name = entry_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();

        let subdir_files: usize = fs::read_dir(&entry_path)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(|sub| sub.ok())
            .filter(|sub| sub.path().is_file())
            .count();
        total_files += subdir_files;

        if !declared_harnesses.iter().any(|harness| harness == &subdir_name) {
            warnings.push(format!(
                "Init subdirectory '{}' does not match any harness in `harnesses[]`. Files in this subdir will never run.",
                subdir_name
            ));
        }

        if subdir_files == 0 {
            warnings.push(format!(
                "Init subdirectory '{}' is empty.",
                subdir_name
            ));
        }
    }

    if total_files == 0 {
        errors.push(format!(
            "Init directory does not contain any files (flat or in harness subdirs): {}",
            path.display()
        ));
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
        fs::create_dir_all(scenario_dir.join("prompts")).expect("prompts");
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
  "personaPrompts": {"baseline":"prompts/baseline.md","informed":"prompts/informed.md"},
  "infrastructure": {"services": ["clickhouse"]}
}"#,
        );
        write_file(&scenario_dir.join("prompts/baseline.md"), "Do the task.\n");
        write_file(&scenario_dir.join("prompts/informed.md"), "Use ClickHouse.\n");
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
    fn validate_accepts_per_harness_init_subdirs() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Switch the scenario to declare two harnesses and add a matching subdir.
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
  "personaPrompts": {"baseline":"prompts/baseline.md","informed":"prompts/informed.md"},
  "infrastructure": {"services": ["clickhouse"]}
}"#,
        );
        write_file(
            &temp.path().join("apps/web/data/harnesses/olap-for-swe.json"),
            "{}\n",
        );
        write_file(
            &scenario_dir.join("init/olap-for-swe/seed-workspace.sh"),
            "#!/usr/bin/env bash\n",
        );

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report =
            validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "errors: {:?}", report.errors);
        // No subdir-mismatch warning should fire for `olap-for-swe`.
        assert!(!report
            .warnings
            .iter()
            .any(|w| w.contains("does not match any harness")));
    }

    #[test]
    fn validate_warns_when_init_subdir_does_not_match_a_harness() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Subdir name `not-a-harness` is not in the scenario's harnesses array.
        write_file(
            &scenario_dir.join("init/not-a-harness/seed.sh"),
            "#!/usr/bin/env bash\n",
        );

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report =
            validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "should still pass; subdir mismatch is a warning");
        assert!(report
            .warnings
            .iter()
            .any(|w| w.contains("'not-a-harness'") && w.contains("does not match any harness")));
    }

    #[test]
    fn validate_accepts_subdir_only_init_without_flat_files() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_valid_scenario(temp.path());
        let scenario_dir = temp.path().join("scenarios/test-scenario");

        // Remove the flat init file; rely entirely on a subdir.
        fs::remove_file(scenario_dir.join("init/setup.sh")).expect("remove flat init");
        write_file(
            &scenario_dir.join("init/base-rt/seed.sh"),
            "#!/usr/bin/env bash\n",
        );

        let args = ValidateArgs {
            scenario: "test-scenario".to_string(),
            competencies: None,
            features: None,
            starting_state: None,
            services: None,
            format: OutputFormat::Table,
        };
        let report =
            validate_at_dir(&scenario_dir, &args).expect("validate");

        assert!(report.passed, "errors: {:?}", report.errors);
    }
}
