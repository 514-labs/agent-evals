use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::Args;
use tracing::info;

#[derive(Args)]
pub struct CreateArgs {
    /// Scenario ID (used as directory name and JSON id field)
    #[arg(short, long)]
    pub name: String,

    /// Business domain
    #[arg(short, long, value_enum)]
    pub domain: Domain,

    /// Difficulty tier
    #[arg(short, long, value_enum, default_value = "tier-1")]
    pub tier: Tier,

    /// Evaluation harness
    #[arg(long, default_value = "bare")]
    pub harness: String,

    /// Scenarios root directory
    #[arg(long, default_value = "scenarios")]
    pub dir: PathBuf,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Domain {
    #[value(name = "b2b-saas")]
    B2bSaas,
    #[value(name = "b2c-saas")]
    B2cSaas,
    #[value(name = "ugc")]
    Ugc,
    #[value(name = "e-commerce")]
    ECommerce,
    #[value(name = "advertising")]
    Advertising,
    #[value(name = "consumption-based-infra")]
    ConsumptionBasedInfra,
}

impl std::fmt::Display for Domain {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::B2bSaas => write!(f, "b2b-saas"),
            Self::B2cSaas => write!(f, "b2c-saas"),
            Self::Ugc => write!(f, "ugc"),
            Self::ECommerce => write!(f, "e-commerce"),
            Self::Advertising => write!(f, "advertising"),
            Self::ConsumptionBasedInfra => write!(f, "consumption-based-infra"),
        }
    }
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Tier {
    #[value(name = "tier-1")]
    Tier1,
    #[value(name = "tier-2")]
    Tier2,
    #[value(name = "tier-3")]
    Tier3,
}

impl std::fmt::Display for Tier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Tier1 => write!(f, "tier-1"),
            Self::Tier2 => write!(f, "tier-2"),
            Self::Tier3 => write!(f, "tier-3"),
        }
    }
}

pub async fn execute(args: CreateArgs) -> Result<()> {
    let root = args.dir.join(&args.name);

    if root.exists() {
        anyhow::bail!("Directory already exists: {}", root.display());
    }

    info!(name = %args.name, domain = %args.domain, tier = %args.tier, "Scaffolding scenario");

    let dirs = ["prompts", "init", "assertions"];
    for d in &dirs {
        fs::create_dir_all(root.join(d))
            .with_context(|| format!("Failed to create {d} directory"))?;
    }

    write_file(
        &root.join("prompts/naive.md"),
        "<!-- Describe the task in plain language. No tool names, no implementation hints. -->\n",
    )?;
    write_file(
        &root.join("prompts/savvy.md"),
        "<!-- Describe the task with specific tools, targets, and technical constraints. -->\n",
    )?;

    write_file(
        &root.join("supervisord.conf"),
        &format!(
            "[program:postgres]\n\
             command=/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/data\n\
             autostart=true\n\
             autorestart=false\n\
             \n\
             ; Add additional services below\n"
        ),
    )?;

    write_file(&root.join("init/postgres-setup.sql"), "-- Schema and seed data for Postgres\n")?;

    let gate_names = ["functional", "correct", "robust", "performant", "production"];
    for gate in &gate_names {
        write_file(
            &root.join(format!("assertions/{gate}.ts")),
            &format!(
                "import type {{ AssertionContext }} from \"@dec-bench/eval-core\";\n\
                 \n\
                 export async function example_check(ctx: AssertionContext) {{\n\
                 \x20\x20// TODO: implement {gate} assertion\n\
                 \x20\x20return false;\n\
                 }}\n"
            ),
        )?;
    }

    let scenario_json = serde_json::json!({
        "id": args.name,
        "title": "",
        "description": "",
        "tier": args.tier.to_string(),
        "domain": args.domain.to_string(),
        "harness": args.harness,
        "tasks": [],
        "personaPrompts": {
            "naive": "prompts/naive.md",
            "savvy": "prompts/savvy.md"
        },
        "tags": [],
        "baselineMetrics": {
            "queryLatencyMs": 0,
            "storageBytes": 0,
            "costPerQueryUsd": 0
        },
        "referenceMetrics": {
            "queryLatencyMs": 0,
            "storageBytes": 0,
            "costPerQueryUsd": 0
        }
    });

    write_file(
        &root.join("scenario.json"),
        &serde_json::to_string_pretty(&scenario_json)?,
    )?;

    println!("Created scenario at {}", root.display());
    println!();
    print_tree(&root, "", true)?;
    println!();
    println!("Next steps:");
    println!("  1. Fill in prompts/naive.md and prompts/savvy.md");
    println!("  2. Add init scripts and seed data");
    println!("  3. Implement gate assertions");
    println!("  4. Complete scenario.json metadata");
    println!();
    println!("Run with:");
    println!("  dec-bench run --scenario {}", args.name);

    Ok(())
}

fn write_file(path: &Path, content: &str) -> Result<()> {
    fs::write(path, content).with_context(|| format!("Failed to write {}", path.display()))
}

fn print_tree(dir: &Path, prefix: &str, is_last: bool) -> Result<()> {
    let name = dir.file_name().unwrap_or_default().to_string_lossy();
    let connector = if prefix.is_empty() { "" } else if is_last { "└── " } else { "├── " };
    println!("{prefix}{connector}{name}/");

    let mut entries: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let child_prefix = if prefix.is_empty() {
        String::new()
    } else if is_last {
        format!("{prefix}    ")
    } else {
        format!("{prefix}│   ")
    };

    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        let last = i == total - 1;
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        let conn = if last { "└── " } else { "├── " };

        if path.is_dir() {
            print_tree(&path, &child_prefix, last)?;
        } else {
            println!("{child_prefix}{conn}{fname}");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn create_scaffolds_expected_files() {
        let temp = tempfile::tempdir().expect("temp dir");
        let args = CreateArgs {
            name: "sample-scenario".to_string(),
            domain: Domain::Ugc,
            tier: Tier::Tier1,
            harness: "bare".to_string(),
            dir: temp.path().to_path_buf(),
        };

        execute(args).await.expect("create succeeds");

        let root = temp.path().join("sample-scenario");
        assert!(root.join("scenario.json").exists());
        assert!(root.join("prompts/naive.md").exists());
        assert!(root.join("prompts/savvy.md").exists());
        assert!(root.join("init/postgres-setup.sql").exists());
        assert!(root.join("assertions/functional.ts").exists());
        assert!(root.join("assertions/correct.ts").exists());
        assert!(root.join("assertions/robust.ts").exists());
        assert!(root.join("assertions/performant.ts").exists());
        assert!(root.join("assertions/production.ts").exists());
        assert!(root.join("supervisord.conf").exists());
    }
}
