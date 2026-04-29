use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{bail, Context, Result};
use clap::Args;

use super::agent::Agent;
use super::preflight;

#[derive(Args, Clone, Debug)]
pub struct BuildArgs {
    /// Scenario ID to build
    #[arg(short, long)]
    pub scenario: String,

    /// Evaluation harness to use
    #[arg(long, default_value = "base-rt")]
    pub harness: String,

    /// Agent runner ID baked into the image tag
    #[arg(long, value_enum, default_value_t = Agent::ClaudeCode)]
    pub agent: Agent,

    /// Model slug baked into the image tag
    #[arg(long, default_value = "claude-sonnet-4-20250514")]
    pub model: String,

    /// Image version suffix
    #[arg(long, default_value = "v0.2.0")]
    pub version: String,

    /// Base image tag used for the layered build
    #[arg(long, default_value = "ghcr.io/514-labs/dec-bench:base")]
    pub base_image: String,

    /// Replace an installed tool artifact with a local copy (repeatable).
    /// Format: `NAME=PATH`. NAME must match a subdirectory of `tools/`
    /// (that subdirectory provides the override handler). PATH may be a
    /// file or a directory depending on the tool.
    /// See docs: /docs/add-eval/testing-local-overrides
    #[arg(long = "override", value_name = "NAME=PATH")]
    pub overrides: Vec<String>,

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
    /// Local source paths to stage into `docker/.tmp/overrides/<name>`
    /// before invoking `docker/build.sh`. Keyed by override name.
    staged_overrides: Vec<(String, PathBuf)>,
}

pub async fn execute(args: BuildArgs) -> Result<()> {
    let plan = build_plan(&args)?;

    if args.dry_run {
        println!("Dry run: would invoke {}", plan.script_path.display());
        println!("Repository root: {}", plan.repo_root.display());
        println!("Final image tag: {}", plan.image_tag);
        if !plan.staged_overrides.is_empty() {
            println!("Overrides:");
            for (name, src) in &plan.staged_overrides {
                println!("  {name} <- {}", src.display());
            }
        }
        println!(
            "Command: {} {}",
            plan.script_path.display(),
            plan.command_args.join(" ")
        );
        return Ok(());
    }

    preflight::check_docker()?;

    stage_overrides(&plan)?;

    println!(
        "Building scenario={} harness={} agent={} model={} version={}",
        args.scenario,
        args.harness,
        args.agent.slug(),
        args.model,
        args.version
    );

    let output = Command::new(&plan.script_path)
        .args(&plan.command_args)
        .current_dir(&plan.repo_root)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::piped())
        .output()
        .with_context(|| format!("Failed to start {}", plan.script_path.display()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Surface stderr so the user can see what Docker reported
        if !stderr.trim().is_empty() {
            eprint!("{stderr}");
        }

        let is_daemon_issue = stderr.contains("_ping")
            || stderr.contains("Is the docker daemon running")
            || stderr.contains("500 Internal Server Error");

        let exit_code = output
            .status
            .code()
            .map(|code| code.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        if is_daemon_issue {
            bail!(
                "Build failed for image '{}' with exit status {exit_code}\n\n\
                 The Docker daemon appears to not be responding.\n\
                 Start Docker Desktop or restart the Docker daemon, then try again.",
                plan.image_tag,
            );
        } else {
            bail!(
                "Build failed for image '{}' with exit status {exit_code}",
                plan.image_tag,
            );
        }
    }

    println!("Built image: {}", plan.image_tag);
    Ok(())
}

fn build_plan(args: &BuildArgs) -> Result<BuildPlan> {
    let repo_root = preflight::resolve_repo_root()?;
    build_plan_at_repo_root(&repo_root, args)
}

fn build_plan_at_repo_root(repo_root: &Path, args: &BuildArgs) -> Result<BuildPlan> {
    let script_path = repo_root.join("docker/build.sh");
    preflight::ensure_exists(&script_path, "Build helper script")?;

    let scenario_dir = repo_root.join("scenarios").join(&args.scenario);
    preflight::ensure_exists(&scenario_dir, "Scenario directory")?;

    let harness_json = repo_root
        .join("apps/web/data/harnesses")
        .join(format!("{}.json", args.harness));
    preflight::ensure_exists(&harness_json, "Harness JSON")?;

    let agent_run_script = repo_root
        .join("docker/agents")
        .join(args.agent.slug())
        .join("run.sh");
    preflight::ensure_exists(&agent_run_script, "Agent run script")?;

    let staged_overrides = parse_and_validate_overrides(repo_root, &args.overrides)?;

    let image_tag = format!(
        "{}.{}.{}.{}.{}",
        args.scenario,
        args.harness,
        args.agent.slug(),
        args.model,
        args.version
    );

    let mut command_args = vec![
        "--scenario".to_string(),
        args.scenario.clone(),
        "--harness".to_string(),
        args.harness.clone(),
        "--agent".to_string(),
        args.agent.slug().to_string(),
        "--model".to_string(),
        args.model.clone(),
        "--version".to_string(),
        args.version.clone(),
        "--base-image".to_string(),
        args.base_image.clone(),
    ];

    for (name, _) in &staged_overrides {
        command_args.push("--override".to_string());
        command_args.push(name.clone());
    }

    Ok(BuildPlan {
        repo_root: repo_root.to_path_buf(),
        script_path,
        image_tag,
        command_args,
        staged_overrides,
    })
}

/// Parse each `--override` spec, verify the tool name is a registered module
/// and the source path exists. The `tools/` directory listing is the registry.
fn parse_and_validate_overrides(
    repo_root: &Path,
    specs: &[String],
) -> Result<Vec<(String, PathBuf)>> {
    let tools_dir = repo_root.join("tools");
    let known_tools = list_tools_with_override_handlers(&tools_dir)?;

    let mut result = Vec::new();
    for spec in specs {
        let (name, path) = spec.split_once('=').ok_or_else(|| {
            anyhow::anyhow!(
                "Invalid --override value '{spec}': expected NAME=PATH\n\nExample: --override moose=/path/to/moose"
            )
        })?;

        if name.is_empty() {
            bail!("Invalid --override value '{spec}': NAME must be non-empty");
        }

        if !known_tools.iter().any(|n| n == name) {
            bail!(
                "Unknown override target '{name}'. Known tools (with override handlers): {}",
                known_tools.join(", ")
            );
        }

        let src = PathBuf::from(path);
        if !src.exists() {
            bail!(
                "Override source for '{name}' not found: {}\n\nCheck the path exists and is readable.",
                src.display()
            );
        }

        result.push((name.to_string(), src));
    }
    Ok(result)
}

/// Return every subdirectory of `tools/` that ships an executable
/// `override.sh`. That set is the authoritative list of substitutable names.
fn list_tools_with_override_handlers(tools_dir: &Path) -> Result<Vec<String>> {
    let mut names = Vec::new();
    if !tools_dir.is_dir() {
        return Ok(names);
    }
    for entry in fs::read_dir(tools_dir)
        .with_context(|| format!("Failed to read {}", tools_dir.display()))?
    {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let override_sh = entry.path().join("override.sh");
        if override_sh.is_file() {
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Stage each override source under `docker/.tmp/overrides/<name>` with the
/// exact layout expected inside the image (`/tmp/overrides/<name>`). Clears
/// any leftovers from a prior build so stale overrides can't leak in.
fn stage_overrides(plan: &BuildPlan) -> Result<()> {
    let stage_root = plan.repo_root.join("docker/.tmp/overrides");

    if stage_root.exists() {
        fs::remove_dir_all(&stage_root)
            .with_context(|| format!("Failed to clear {}", stage_root.display()))?;
    }
    fs::create_dir_all(&stage_root)
        .with_context(|| format!("Failed to create {}", stage_root.display()))?;

    // Even when there are no overrides, keep the dir around so operators can
    // inspect it; Docker never reads it unless --override was passed.
    for (name, src) in &plan.staged_overrides {
        let dest = stage_root.join(name);
        copy_path(src, &dest)
            .with_context(|| format!("Failed to stage override '{name}' from {}", src.display()))?;
    }

    Ok(())
}

fn copy_path(src: &Path, dest: &Path) -> Result<()> {
    let meta = fs::metadata(src).with_context(|| format!("Failed to stat {}", src.display()))?;
    if meta.is_dir() {
        copy_dir_recursive(src, dest)
    } else {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(src, dest)?;
        make_executable_if_needed(dest)?;
        Ok(())
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

#[cfg(unix)]
fn make_executable_if_needed(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(perms.mode() | 0o111);
    fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
fn make_executable_if_needed(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    fn seed_repo(path: &Path) {
        fs::create_dir_all(path.join(".git")).expect("git dir");
        fs::create_dir_all(path.join("docker")).expect("docker dir");
        fs::create_dir_all(path.join("scenarios/foo")).expect("scenario dir");
        fs::create_dir_all(path.join("apps/web/data/harnesses")).expect("harness dir");
        fs::create_dir_all(path.join("docker/agents/claude-code")).expect("agent dir");
        fs::write(path.join("docker/build.sh"), "#!/usr/bin/env bash\n").expect("build script");
        fs::write(path.join("apps/web/data/harnesses/base-rt.json"), "{}\n").expect("harness json");
        fs::write(
            path.join("docker/agents/claude-code/run.sh"),
            "#!/usr/bin/env bash\n",
        )
        .expect("run script");
    }

    fn seed_tool_with_override(repo: &Path, name: &str) {
        let tool_dir = repo.join("tools").join(name);
        fs::create_dir_all(&tool_dir).expect("tool dir");
        let override_sh = tool_dir.join("override.sh");
        fs::write(&override_sh, "#!/usr/bin/env bash\n").expect("override script");
        let mut perms = fs::metadata(&override_sh).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&override_sh, perms).unwrap();
    }

    fn default_args() -> BuildArgs {
        BuildArgs {
            scenario: "foo".to_string(),
            harness: "base-rt".to_string(),
            agent: Agent::ClaudeCode,
            model: "test-model".to_string(),
            version: "v-test".to_string(),
            base_image: "base:image".to_string(),
            overrides: Vec::new(),
            dry_run: false,
        }
    }

    #[test]
    fn build_plan_uses_repo_root_and_formats_image_tag() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());

        let plan = build_plan_at_repo_root(temp.path(), &default_args()).expect("build plan");

        assert!(plan.repo_root.join(".git").exists());
        assert_eq!(plan.image_tag, "foo.base-rt.claude-code.test-model.v-test");
        assert_eq!(plan.command_args[0], "--scenario");
        assert!(plan.script_path.ends_with("docker/build.sh"));
        assert!(plan.staged_overrides.is_empty());
    }

    #[test]
    fn build_plan_errors_when_harness_json_is_missing() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        fs::remove_file(temp.path().join("apps/web/data/harnesses/base-rt.json"))
            .expect("remove harness");

        let err = build_plan_at_repo_root(temp.path(), &default_args())
            .expect_err("missing harness should fail");

        assert!(err.to_string().contains("Harness JSON not found"));
    }

    #[test]
    fn build_plan_parses_override_spec() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        let fake_binary = temp.path().join("local-moose");
        fs::write(&fake_binary, b"#!/bin/sh\necho fake\n").unwrap();

        let mut args = default_args();
        args.overrides = vec![format!("moose={}", fake_binary.display())];

        let plan = build_plan_at_repo_root(temp.path(), &args).expect("plan with override");

        assert_eq!(plan.staged_overrides.len(), 1);
        assert_eq!(plan.staged_overrides[0].0, "moose");
        assert_eq!(plan.staged_overrides[0].1, fake_binary);

        // The CLI appends --override <name> tokens so build.sh can route them.
        let idx = plan
            .command_args
            .iter()
            .position(|s| s == "--override")
            .expect("--override in command_args");
        assert_eq!(plan.command_args[idx + 1], "moose");
    }

    #[test]
    fn build_plan_rejects_unknown_override_name() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        let src = temp.path().join("src");
        fs::write(&src, "x").unwrap();

        let mut args = default_args();
        args.overrides = vec![format!("bogus={}", src.display())];

        let err =
            build_plan_at_repo_root(temp.path(), &args).expect_err("unknown tool should fail");
        let msg = err.to_string();
        assert!(msg.contains("Unknown override target"));
        assert!(msg.contains("moose"));
    }

    #[test]
    fn build_plan_rejects_missing_override_source() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        let mut args = default_args();
        args.overrides = vec!["moose=/definitely/does/not/exist".to_string()];

        let err = build_plan_at_repo_root(temp.path(), &args)
            .expect_err("missing source path should fail");
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn build_plan_rejects_malformed_override_spec() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        let mut args = default_args();
        args.overrides = vec!["no-equals-sign".to_string()];

        let err = build_plan_at_repo_root(temp.path(), &args).expect_err("malformed spec");
        assert!(err.to_string().contains("NAME=PATH"));
    }

    #[test]
    fn stage_overrides_copies_file_source() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        let src_bin = temp.path().join("binary");
        fs::write(&src_bin, b"contents").unwrap();

        let mut args = default_args();
        args.overrides = vec![format!("moose={}", src_bin.display())];
        let plan = build_plan_at_repo_root(temp.path(), &args).unwrap();

        stage_overrides(&plan).expect("stage succeeds");

        let staged = temp.path().join("docker/.tmp/overrides/moose");
        assert!(staged.is_file());
        assert_eq!(fs::read(&staged).unwrap(), b"contents");

        let mode = fs::metadata(&staged).unwrap().permissions().mode();
        assert_ne!(mode & 0o111, 0, "staged file should be executable");
    }

    #[test]
    fn stage_overrides_copies_directory_source() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "claude-skills");

        let src_dir = temp.path().join("skills-src");
        fs::create_dir_all(src_dir.join("custom-skill")).unwrap();
        fs::write(src_dir.join("custom-skill/SKILL.md"), "# custom").unwrap();

        let mut args = default_args();
        args.overrides = vec![format!("claude-skills={}", src_dir.display())];
        let plan = build_plan_at_repo_root(temp.path(), &args).unwrap();

        stage_overrides(&plan).unwrap();

        let staged = temp
            .path()
            .join("docker/.tmp/overrides/claude-skills/custom-skill/SKILL.md");
        assert!(staged.is_file());
        assert_eq!(fs::read_to_string(&staged).unwrap(), "# custom");
    }

    #[test]
    fn stage_overrides_clears_stale_entries() {
        let temp = tempfile::tempdir().expect("temp dir");
        seed_repo(temp.path());
        seed_tool_with_override(temp.path(), "moose");

        // Pre-seed a stale override that should not survive the next build.
        let stage_root = temp.path().join("docker/.tmp/overrides");
        fs::create_dir_all(&stage_root).unwrap();
        fs::write(stage_root.join("stale-tool"), "leftover").unwrap();

        let plan = build_plan_at_repo_root(temp.path(), &default_args()).unwrap();
        stage_overrides(&plan).unwrap();

        assert!(
            !stage_root.join("stale-tool").exists(),
            "stale override should have been cleared"
        );
    }
}
