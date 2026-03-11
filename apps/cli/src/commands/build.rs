use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{bail, Context, Result};
use clap::Args;

#[derive(Args, Clone, Debug)]
pub struct BuildArgs {
    /// Scenario ID to build
    #[arg(short, long)]
    pub scenario: String,

    /// Evaluation harness to use
    #[arg(long, default_value = "base-rt")]
    pub harness: String,

    /// Agent runner ID baked into the image tag
    #[arg(long, default_value = "claude-code")]
    pub agent: String,

    /// Model slug baked into the image tag
    #[arg(long, default_value = "claude-sonnet-4-20250514")]
    pub model: String,

    /// Image version suffix
    #[arg(long, default_value = "v0.1.0")]
    pub version: String,

    /// Base image tag used for the layered build
    #[arg(long, default_value = "ghcr.io/514-labs/dec-bench:base")]
    pub base_image: String,

    /// Print the build plan without invoking Docker
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(Debug)]
struct BuildPlan {
    repo_root: PathBuf,
    script_path: PathBuf,
    image_tag: String,
    command_args: Vec<String>,
}

pub async fn execute(args: BuildArgs) -> Result<()> {
    let plan = build_plan(&args)?;

    if args.dry_run {
        println!("Dry run: would invoke {}", plan.script_path.display());
        println!("Repository root: {}", plan.repo_root.display());
        println!("Final image tag: {}", plan.image_tag);
        println!(
            "Command: {} {}",
            plan.script_path.display(),
            plan.command_args.join(" ")
        );
        return Ok(());
    }

    println!(
        "Building scenario={} harness={} agent={} model={} version={}",
        args.scenario, args.harness, args.agent, args.model, args.version
    );

    let status = Command::new(&plan.script_path)
        .args(&plan.command_args)
        .current_dir(&plan.repo_root)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .with_context(|| format!("Failed to start {}", plan.script_path.display()))?;

    if !status.success() {
        bail!(
            "Build failed for image '{}' with exit status {}",
            plan.image_tag,
            status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        );
    }

    println!("Built image: {}", plan.image_tag);
    Ok(())
}

fn build_plan(args: &BuildArgs) -> Result<BuildPlan> {
    let repo_root = resolve_repo_root()?;
    build_plan_at_repo_root(&repo_root, args)
}

fn build_plan_at_repo_root(repo_root: &Path, args: &BuildArgs) -> Result<BuildPlan> {
    let script_path = repo_root.join("docker/build.sh");
    ensure_exists(&script_path, "Build helper script")?;

    let scenario_dir = repo_root.join("scenarios").join(&args.scenario);
    ensure_exists(&scenario_dir, "Scenario directory")?;

    let harness_json = repo_root
        .join("apps/web/data/harnesses")
        .join(format!("{}.json", args.harness));
    ensure_exists(&harness_json, "Harness JSON")?;

    let agent_run_script = repo_root
        .join("docker/agents")
        .join(&args.agent)
        .join("run.sh");
    ensure_exists(&agent_run_script, "Agent run script")?;

    let image_tag = format!(
        "{}.{}.{}.{}.{}",
        args.scenario, args.harness, args.agent, args.model, args.version
    );

    let command_args = vec![
        "--scenario".to_string(),
        args.scenario.clone(),
        "--harness".to_string(),
        args.harness.clone(),
        "--agent".to_string(),
        args.agent.clone(),
        "--model".to_string(),
        args.model.clone(),
        "--version".to_string(),
        args.version.clone(),
        "--base-image".to_string(),
        args.base_image.clone(),
    ];

    Ok(BuildPlan {
        repo_root: repo_root.to_path_buf(),
        script_path,
        image_tag,
        command_args,
    })
}

fn ensure_exists(path: &Path, label: &str) -> Result<()> {
    if !path.exists() {
        bail!("{label} does not exist: {}", path.display());
    }
    Ok(())
}

fn resolve_repo_root() -> Result<PathBuf> {
    let cwd = std::env::current_dir().context("Failed to determine current directory")?;
    for ancestor in cwd.ancestors() {
        if ancestor.join(".git").exists() {
            return Ok(ancestor.to_path_buf());
        }
    }
    bail!("Could not locate repository root from {}", cwd.display())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn seed_repo(path: &Path) {
        fs::create_dir_all(path.join(".git")).expect("git dir");
        fs::create_dir_all(path.join("docker")).expect("docker dir");
        fs::create_dir_all(path.join("scenarios/foo")).expect("scenario dir");
        fs::create_dir_all(path.join("apps/web/data/harnesses")).expect("harness dir");
        fs::create_dir_all(path.join("docker/agents/test-agent")).expect("agent dir");
        fs::write(path.join("docker/build.sh"), "#!/usr/bin/env bash\n").expect("build script");
        fs::write(
            path.join("apps/web/data/harnesses/base-rt.json"),
            "{}\n",
        )
        .expect("harness json");
        fs::write(
            path.join("docker/agents/test-agent/run.sh"),
            "#!/usr/bin/env bash\n",
        )
        .expect("run script");
    }

    #[test]
    fn build_plan_uses_repo_root_and_formats_image_tag() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());

        let args = BuildArgs {
            scenario: "foo".to_string(),
            harness: "base-rt".to_string(),
            agent: "test-agent".to_string(),
            model: "test-model".to_string(),
            version: "v-test".to_string(),
            base_image: "base:image".to_string(),
            dry_run: false,
        };
        let plan = build_plan_at_repo_root(temp.path(), &args).expect("build plan");

        assert!(plan.repo_root.join(".git").exists());
        assert_eq!(plan.image_tag, "foo.base-rt.test-agent.test-model.v-test");
        assert_eq!(plan.command_args[0], "--scenario");
        assert!(plan.script_path.ends_with("docker/build.sh"));
    }

    #[test]
    fn build_plan_errors_when_harness_json_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        fs::remove_file(temp.path().join("apps/web/data/harnesses/base-rt.json"))
            .expect("remove harness");

        let args = BuildArgs {
            scenario: "foo".to_string(),
            harness: "base-rt".to_string(),
            agent: "test-agent".to_string(),
            model: "test-model".to_string(),
            version: "v-test".to_string(),
            base_image: "base:image".to_string(),
            dry_run: false,
        };
        let err = build_plan_at_repo_root(temp.path(), &args)
            .expect_err("missing harness should fail");

        assert!(err.to_string().contains("Harness JSON does not exist"));
    }
}
