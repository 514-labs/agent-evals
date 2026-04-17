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

    /// Evaluation harnesses (comma-separated, e.g. base-rt,olap-for-swe)
    #[arg(long, default_value = "base-rt,classic-de,olap-for-swe", value_delimiter = ',')]
    pub harnesses: Vec<String>,

    /// Scenarios root directory
    #[arg(long, default_value = "scenarios")]
    pub dir: PathBuf,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Domain {
    #[value(name = "foo-bar")]
    FooBar,
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
            Self::FooBar => write!(f, "foo-bar"),
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
        &root.join("prompts/baseline.md"),
        "<!-- Describe the task in plain language. No tool names, no implementation hints. -->\n",
    )?;
    write_file(
        &root.join("prompts/informed.md"),
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

    // When 2+ harnesses are declared, scaffold per-harness init subdirs.
    // Files in init/<harness-id>/ run only when that harness is active;
    // flat files in init/ run for every harness. See SKILL.md "Three lifecycle moments".
    if args.harnesses.len() >= 2 {
        for harness in &args.harnesses {
            let subdir = root.join("init").join(harness);
            fs::create_dir_all(&subdir)
                .with_context(|| format!("Failed to create init/{harness} directory"))?;
            write_file(
                &subdir.join("seed-workspace.sh"),
                &format!(
                    "#!/bin/bash\n\
                     # Per-harness init for `{harness}`. Runs only when this harness is active.\n\
                     # Use this to seed harness-specific starting state (e.g. scaffold a Moose project,\n\
                     # generate a dbt project, etc.). Common setup belongs in flat init/*.sh files.\n"
                ),
            )?;
        }
    }

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
        "lede": "",
        "tier": args.tier.to_string(),
        "domain": args.domain.to_string(),
        "harnesses": args.harnesses,
        "tasks": [],
        "personaPrompts": {
            "baseline": "prompts/baseline.md",
            "informed": "prompts/informed.md"
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
    println!("Three moments to know about:");
    println!("  - To install a TOOL (e.g. a CLI like moose, dbt) -> add a custom harness in");
    println!("    apps/web/data/harnesses/<id>.json (runs at image BUILD time, once per image).");
    println!("  - To seed STATE for every harness -> flat files in init/ (run at container");
    println!("    STARTUP, every run).");
    if args.harnesses.len() >= 2 {
        println!("  - To seed STATE that varies per harness -> files in init/<harness-id>/");
        println!("    (run at container STARTUP, only when that harness is active).");
        println!("    Subdirs were scaffolded for: {}.", args.harnesses.join(", "));
    } else {
        println!("  - To seed STATE that varies per harness -> files in init/<harness-id>/");
        println!("    (only relevant when scenario declares 2+ harnesses).");
    }
    println!();
    println!("Next steps:");
    println!("  1. Fill in prompts/baseline.md and prompts/informed.md");
    println!("  2. Add init scripts, seed data, and gate assertions");
    println!("  3. Complete scenario.json metadata (including lede: \"In this scenario, an agent must...\")");
    println!("  4. Validate the scenario:");
    println!("     dec-bench validate --scenario {}", args.name);
    println!("  5. Build the local eval image:");
    println!("     dec-bench build --scenario {}", args.name);
    println!("  6. Run the eval:");
    println!("     dec-bench run --scenario {}", args.name);
    println!("  7. Inspect the latest run:");
    println!("     dec-bench results --latest --scenario {}", args.name);
    println!("  8. Open the audit UI for a run:");
    println!("     dec-bench audit open --scenario {} --run-id <run-id>", args.name);

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
            harnesses: vec!["base-rt".to_string(), "classic-de".to_string(), "olap-for-swe".to_string()],
            dir: temp.path().to_path_buf(),
        };

        execute(args).await.expect("create succeeds");

        let root = temp.path().join("sample-scenario");
        assert!(root.join("scenario.json").exists());
        assert!(root.join("prompts/baseline.md").exists());
        assert!(root.join("prompts/informed.md").exists());
        assert!(root.join("init/postgres-setup.sql").exists());
        assert!(root.join("assertions/functional.ts").exists());
        assert!(root.join("assertions/correct.ts").exists());
        assert!(root.join("assertions/robust.ts").exists());
        assert!(root.join("assertions/performant.ts").exists());
        assert!(root.join("assertions/production.ts").exists());
        assert!(root.join("supervisord.conf").exists());

        // 3 harnesses declared -> per-harness init subdirs scaffolded.
        assert!(root.join("init/base-rt/seed-workspace.sh").exists());
        assert!(root.join("init/classic-de/seed-workspace.sh").exists());
        assert!(root.join("init/olap-for-swe/seed-workspace.sh").exists());
    }

    #[tokio::test]
    async fn create_skips_per_harness_subdirs_for_single_harness_scenarios() {
        let temp = tempfile::tempdir().expect("temp dir");
        let args = CreateArgs {
            name: "single-harness-scenario".to_string(),
            domain: Domain::FooBar,
            tier: Tier::Tier1,
            harnesses: vec!["base-rt".to_string()],
            dir: temp.path().to_path_buf(),
        };

        execute(args).await.expect("create succeeds");

        let root = temp.path().join("single-harness-scenario");
        assert!(root.join("init/postgres-setup.sql").exists());
        assert!(!root.join("init/base-rt").exists(),
            "single-harness scenarios should NOT get a per-harness init subdir");
    }
}
