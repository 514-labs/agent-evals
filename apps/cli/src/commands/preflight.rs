use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{bail, Context, Result};

pub fn resolve_repo_root() -> Result<PathBuf> {
    let cwd = std::env::current_dir().context("Failed to determine current directory")?;
    for ancestor in cwd.ancestors() {
        if ancestor.join(".git").exists() {
            return Ok(ancestor.to_path_buf());
        }
    }
    bail!(
        "Could not locate the DEC Bench repository root from {}.\n\n\
         Make sure you are running this command from inside a cloned copy of the repository:\n\n\
         \tgit clone https://github.com/514-labs/agent-evals.git\n\
         \tcd agent-evals",
        cwd.display()
    )
}

pub fn resolve_repo_path(rel: &str) -> Result<PathBuf> {
    let cwd = std::env::current_dir().context("Failed to determine current directory")?;
    for ancestor in cwd.ancestors() {
        let candidate = ancestor.join(rel);
        if candidate.exists() || ancestor.join(".git").exists() {
            return Ok(candidate);
        }
    }
    bail!(
        "Could not locate '{}' from {}.\n\n\
         Make sure you are running this command from inside the DEC Bench repository:\n\n\
         \tcd agent-evals",
        rel,
        cwd.display()
    )
}

pub fn ensure_exists(path: &Path, label: &str) -> Result<()> {
    if !path.exists() {
        bail!(
            "{label} not found: {}\n\n\
             Make sure you are running from the repository root and that the file exists.",
            path.display()
        );
    }
    Ok(())
}

pub fn check_docker() -> Result<()> {
    let status = Command::new("docker")
        .arg("info")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(_) => bail!(
            "Docker is installed but the daemon is not running.\n\n\
             Start Docker Desktop or the Docker daemon, then try again."
        ),
        Err(_) => bail!(
            "Docker is not installed or not in your PATH.\n\n\
             Install Docker: https://docs.docker.com/get-docker/"
        ),
    }
}

pub fn check_image_exists(image: &str) -> Result<()> {
    let status = Command::new("docker")
        .args(["image", "inspect", image])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        _ => bail!(
            "Docker image '{}' not found locally.\n\n\
             Build it first:\n\n\
             \tdec-bench build --scenario <SCENARIO> --harness <HARNESS> --agent <AGENT>",
            image
        ),
    }
}

pub fn check_api_keys(agent: &str) -> Result<()> {
    let required: &[&str] = match agent {
        "claude-code" => &["ANTHROPIC_API_KEY"],
        "codex" => &["OPENAI_API_KEY"],
        "cursor" => &["CURSOR_API_KEY"],
        _ => return Ok(()),
    };

    let missing: Vec<&str> = required
        .iter()
        .filter(|key| std::env::var(key).map_or(true, |v| v.trim().is_empty()))
        .copied()
        .collect();

    if missing.is_empty() {
        return Ok(());
    }

    let keys_list = missing
        .iter()
        .map(|k| format!("  - {k}"))
        .collect::<Vec<_>>()
        .join("\n");
    let export_hint = missing
        .iter()
        .map(|k| format!("export {k}=<your-key>"))
        .collect::<Vec<_>>()
        .join("\n\t");

    bail!(
        "Missing required API key{plural} for agent '{agent}':\n\n\
         {keys_list}\n\n\
         Set {them} before running:\n\n\
         \t{export_hint}",
        plural = if missing.len() > 1 { "s" } else { "" },
        them = if missing.len() > 1 { "them" } else { "it" },
    )
}

pub fn check_node() -> Result<()> {
    let status = Command::new("node")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        _ => bail!(
            "Node.js is not installed or not in your PATH.\n\n\
             Install Node.js (v18+): https://nodejs.org/"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_repo_root_finds_git_dir() {
        let temp = tempfile::tempdir().expect("temp dir");
        fs::create_dir_all(temp.path().join(".git")).expect("create .git");

        let original_cwd = std::env::current_dir().expect("cwd");
        std::env::set_current_dir(temp.path()).expect("set cwd");
        let root = resolve_repo_root();
        std::env::set_current_dir(original_cwd).expect("restore cwd");

        assert!(root.is_ok());
    }

    #[test]
    fn ensure_exists_fails_for_missing_path() {
        let result = ensure_exists(Path::new("/nonexistent/path"), "Test file");
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("Test file not found"));
    }

    #[test]
    fn check_api_keys_succeeds_for_unknown_agent() {
        assert!(check_api_keys("unknown-agent").is_ok());
    }
}
