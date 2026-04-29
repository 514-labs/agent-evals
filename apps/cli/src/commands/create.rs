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
    #[value(name = "514")]
    FiveOneFour,
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
            Self::FiveOneFour => write!(f, "514"),
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

    let dirs = ["init", "assertions"];
    for d in &dirs {
        fs::create_dir_all(root.join(d))
            .with_context(|| format!("Failed to create {d} directory"))?;
    }

    // Each harness owns its own prompts. Scaffold harnesses/{harness}/prompts/ for every
    // declared harness — the harness-scenario pair is the unit of ownership.
    for harness in &args.harnesses {
        let prompts_dir = root.join("harnesses").join(harness).join("prompts");
        fs::create_dir_all(&prompts_dir)
            .with_context(|| format!("Failed to create harnesses/{harness}/prompts directory"))?;
        write_file(
            &prompts_dir.join("baseline.md"),
            &format!(
                "<!-- [{harness}] Describe the task in plain language. No tool names, no implementation hints. -->\n"
            ),
        )?;
        write_file(
            &prompts_dir.join("informed.md"),
            &format!(
                "<!-- [{harness}] Describe the task with specific tools, targets, and technical constraints for this harness. -->\n"
            ),
        )?;
    }

    write_file(
        &root.join("supervisord.conf"),
        "[program:postgres]\n\
         command=/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/data\n\
         autostart=true\n\
         autorestart=false\n\
         \n\
         ; Add additional services below\n",
    )?;

    write_file(&root.join("init/postgres-setup.sql"), "-- Schema and seed data for Postgres\n")?;

    // When 2+ harnesses are declared, scaffold per-harness init subdirs inside harnesses/.
    // harnesses/{harness}/init/ runs only when that harness is active;
    // flat files in init/ run for every harness. See SKILL.md "Four setup layers".
    if args.harnesses.len() >= 2 {
        for harness in &args.harnesses {
            let init_subdir = root.join("harnesses").join(harness).join("init");
            fs::create_dir_all(&init_subdir)
                .with_context(|| format!("Failed to create harnesses/{harness}/init directory"))?;
            write_file(
                &init_subdir.join("seed-workspace.sh"),
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
    print_tree(&root)?;
    println!();
    println!("Per-harness prompts test whether the agent uses a named tool well; per-harness");
    println!("init lets each harness boot into the state its tools expect.");
    println!();
    println!("Next steps:");
    println!("  1. Fill in harnesses/<harness-id>/prompts/baseline.md and informed.md for each harness");
    println!("  2. Add seed data: shared in init/, harness-specific in harnesses/<harness-id>/init/");
    println!("  3. Write gate assertions in assertions/");
    println!("  4. Complete scenario.json metadata (including lede: \"In this scenario, an agent must...\")");
    println!("  5. Validate the scenario:");
    println!("     dec-bench validate --scenario {}", args.name);
    println!("  6. Build the local eval image:");
    println!("     dec-bench build --scenario {}", args.name);
    println!("  7. Run the eval:");
    println!("     dec-bench run --scenario {}", args.name);
    println!("  8. Inspect the latest run:");
    println!("     dec-bench results --latest --scenario {}", args.name);
    println!("  9. Open the audit UI for a run:");
    println!("     dec-bench audit open --scenario {} --run-id <run-id>", args.name);

    Ok(())
}

fn write_file(path: &Path, content: &str) -> Result<()> {
    fs::write(path, content).with_context(|| format!("Failed to write {}", path.display()))
}

fn print_tree(root: &Path) -> Result<()> {
    let name = root.file_name().unwrap_or_default().to_string_lossy();
    println!("{name}/");
    print_children(root, "", "")
}

fn print_children(dir: &Path, prefix: &str, rel: &str) -> Result<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        let last = i == total - 1;
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        let conn = if last { "└── " } else { "├── " };
        let child_rel = if rel.is_empty() { fname.clone() } else { format!("{rel}/{fname}") };
        let display = if path.is_dir() { format!("{fname}/") } else { fname.clone() };
        let line = format!("{prefix}{conn}{display}");

        if let Some(note) = annotate(&child_rel) {
            let cols = line.chars().count();
            let pad = 40usize.saturating_sub(cols);
            println!("{line}{:pad$}  # {note}", "", pad = pad);
        } else {
            println!("{line}");
        }

        if path.is_dir() {
            let new_prefix = if last {
                format!("{prefix}    ")
            } else {
                format!("{prefix}│   ")
            };
            print_children(&path, &new_prefix, &child_rel)?;
        }
    }

    Ok(())
}

fn annotate(rel: &str) -> Option<&'static str> {
    if let Some(rest) = rel.strip_prefix("harnesses/") {
        let parts: Vec<&str> = rest.split('/').collect();
        return match parts.as_slice() {
            [_id] => Some("(scenario, harness) pair"),
            [_id, "prompts"] => Some("prompts for this pair (required)"),
            [_id, "init"] => Some("(optional) starting state for this harness"),
            [_id, "install.sh"] => Some("(optional) build-time tools for this harness"),
            [_id, "prompts", "baseline.md"] => Some("casual-user persona"),
            [_id, "prompts", "informed.md"] => Some("specific-instructions persona"),
            _ => None,
        };
    }
    match rel {
        "scenario.json" => Some("metadata; declares harnesses[]"),
        "supervisord.conf" => Some("services that start in the container"),
        "init" => Some("seed data shared across harnesses"),
        "assertions" => Some("gate checks (shared)"),
        "harnesses" => Some("one subdir per harness in scenario.json"),
        _ => None,
    }
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
        assert!(root.join("init/postgres-setup.sql").exists());
        assert!(root.join("assertions/functional.ts").exists());
        assert!(root.join("assertions/correct.ts").exists());
        assert!(root.join("assertions/robust.ts").exists());
        assert!(root.join("assertions/performant.ts").exists());
        assert!(root.join("assertions/production.ts").exists());
        assert!(root.join("supervisord.conf").exists());

        // Each harness gets its own prompts/ under harnesses/<harness-id>/prompts/.
        for harness in &["base-rt", "classic-de", "olap-for-swe"] {
            assert!(root.join(format!("harnesses/{harness}/prompts/baseline.md")).exists(),
                "missing harnesses/{harness}/prompts/baseline.md");
            assert!(root.join(format!("harnesses/{harness}/prompts/informed.md")).exists(),
                "missing harnesses/{harness}/prompts/informed.md");
        }

        // No flat prompts/ at scenario root.
        assert!(!root.join("prompts").exists(), "flat prompts/ should not exist");

        // scenario.json must not contain personaPrompts.
        let scenario_json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(root.join("scenario.json")).unwrap()).unwrap();
        assert!(scenario_json.get("personaPrompts").is_none(), "personaPrompts must not be present");

        // 3 harnesses declared -> per-harness init subdirs scaffolded under harnesses/.
        for harness in &["base-rt", "classic-de", "olap-for-swe"] {
            assert!(root.join(format!("harnesses/{harness}/init/seed-workspace.sh")).exists(),
                "missing harnesses/{harness}/init/seed-workspace.sh");
        }
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
        // Single-harness: prompts still scaffold under harnesses/{harness}/prompts/.
        assert!(root.join("harnesses/base-rt/prompts/baseline.md").exists());
        assert!(root.join("harnesses/base-rt/prompts/informed.md").exists());
        // Single-harness: no per-harness init subdir (no comparison needed).
        assert!(!root.join("harnesses/base-rt/init").exists(),
            "single-harness scenarios should NOT get a per-harness init subdir");
    }
}
