use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::Args;
use serde::Deserialize;

const SCENARIO_REGISTRY_DIR: &str = "apps/web/data/scenarios";

#[derive(Args)]
pub struct ListArgs {
    /// Filter by difficulty tier (e.g., tier-1, tier-2, tier-3)
    #[arg(long)]
    pub tier: Option<String>,

    /// Filter by business domain (e.g., ecommerce, fintech, iot)
    #[arg(long)]
    pub domain: Option<String>,

    /// Filter by task category (e.g., schema-design, query-optimization, ingestion)
    #[arg(long)]
    pub category: Option<String>,

    /// Filter by competency slug (e.g., data-ingestion-and-integration)
    #[arg(long)]
    pub competency: Option<String>,
}

pub async fn execute(args: ListArgs) -> Result<()> {
    let registry_dir = resolve_repo_path(SCENARIO_REGISTRY_DIR)?;
    let scenarios = load_scenarios(&registry_dir)?;

    println!("Available scenarios:");
    println!();

    let filtered: Vec<_> = scenarios
        .iter()
        .filter(|scenario| {
            args.tier
                .as_deref()
                .map_or(true, |tier| scenario.tier == tier)
                && args
                    .domain
                    .as_deref()
                    .map_or(true, |domain| scenario.domain == domain)
                && args.category.as_deref().map_or(true, |category| {
                    scenario.task_categories.iter().any(|entry| entry == category)
                })
                && args.competency.as_deref().map_or(true, |competency| {
                    scenario.competencies.iter().any(|entry| entry == competency)
                })
        })
        .collect();

    if filtered.is_empty() {
        println!("No scenarios match the given filters.");
        return Ok(());
    }

    println!(
        "{:<36} {:<8} {:<24} {:<24} {}",
        "ID", "TIER", "DOMAIN", "CATEGORY", "DESCRIPTION"
    );
    println!("{}", "-".repeat(130));
    for scenario in filtered {
        let category = scenario
            .task_categories
            .first()
            .cloned()
            .unwrap_or_else(|| "-".to_string());
        println!(
            "{:<36} {:<8} {:<24} {:<24} {}",
            scenario.id, scenario.tier, scenario.domain, category, scenario.description
        );
    }
    println!();

    Ok(())
}

#[derive(Debug, Deserialize)]
struct RegistryScenario {
    id: String,
    tier: String,
    domain: String,
    description: String,
    #[serde(default, rename = "taskCategories")]
    task_categories: Vec<String>,
    #[serde(default)]
    competencies: Vec<String>,
}

fn load_scenarios(dir: &Path) -> Result<Vec<RegistryScenario>> {
    let mut scenarios = vec![];
    if !dir.exists() {
        return Ok(scenarios);
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn load_scenarios_ignores_non_json_and_sorts_ids() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::write(
            temp.path().join("z.json"),
            r#"{"id":"z","tier":"tier-1","domain":"ugc","description":"z"}"#,
        )
        .expect("write json");
        fs::write(
            temp.path().join("a.json"),
            r#"{"id":"a","tier":"tier-2","domain":"b2b-saas","description":"a","taskCategories":["ingestion"],"competencies":["environment-setup"]}"#,
        )
        .expect("write json");
        fs::write(temp.path().join("notes.txt"), "ignored").expect("write text");

        let scenarios = load_scenarios(temp.path()).expect("load scenarios");
        assert_eq!(scenarios.len(), 2);
        assert_eq!(scenarios[0].id, "a");
        assert_eq!(scenarios[1].id, "z");
        assert_eq!(scenarios[0].task_categories, vec!["ingestion".to_string()]);
        assert_eq!(
            scenarios[0].competencies,
            vec!["environment-setup".to_string()]
        );
    }

    #[test]
    fn load_scenarios_returns_empty_when_dir_missing() {
        let missing = PathBuf::from("/tmp/this-directory-should-not-exist-rad-bench-tests");
        let scenarios = load_scenarios(&missing).expect("no error for missing dir");
        assert!(scenarios.is_empty());
    }
}
