//! 514-1515: Snapshot the host paths that `run` reads after the agent phase
//! exits, so a branch switch or rebase mid-run cannot change what the evaluator
//! sees.
//!
//! At the start of each `dec-bench run` invocation we copy
//! `scenarios/<id>/assertions/` (for every scenario about to run) and
//! `packages/eval-core/src` into a `tempfile::TempDir`. The runner reads from
//! that snapshot for the rest of the invocation; the temp dir is cleaned up
//! when `RunSnapshot` is dropped.
//!
//! We snapshot the *working tree*, not `HEAD`, so the "tweak an assertion and
//! re-run without committing" loop keeps working — we just freeze whatever's
//! on disk at run start.
//!
//! # 514-1419 / 514-1425 invariant: the snapshot is host-only
//!
//! The snapshot lives in a host-side tempdir. Its contents reach the container
//! ONLY via the existing post-agent `docker cp` calls in `run.rs`
//! (`copy_assertions_into_container` / `copy_eval_core_src_into_container`),
//! which run after the agent phase exits.
//!
//! The snapshot path must NEVER be added to a container `bind`, baked into an
//! image, or exposed via any environment variable visible to the agent.
//! Breaking that invariant would let the agent read assertion files and game
//! the scoring — which is exactly what 514-1419 / 514-1425 sandboxed.
//! If you add a new consumer of this module, route it through the same
//! post-agent `docker cp` pattern.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::SystemTime;

use anyhow::{bail, Context, Result};
use serde_json::json;
use tempfile::TempDir;
use tracing::warn;

use super::preflight;

const ASSERTIONS_REL: &str = "assertions";
const EVAL_CORE_REL: &str = "packages/eval-core/src";

/// A frozen copy of the host paths the runner reads during a run.
///
/// Lives for the duration of a `dec-bench run` invocation. All matrix cells
/// share one snapshot. Drop cleans up the tempdir.
pub struct RunSnapshot {
    /// Path to the snapshot root (a tempfile::TempDir).
    root: PathBuf,
    /// Captured git state (or `None` if git is unavailable / cwd isn't a git
    /// repo). The snapshot is still valid in that case — we just can't label
    /// it with a branch/sha.
    git: Option<GitState>,
    /// Time the snapshot was taken.
    captured_at: SystemTime,
    /// Scenario IDs whose `assertions/` were captured.
    scenario_ids: Vec<String>,
    /// Held to keep the tempdir alive for the snapshot's lifetime.
    _temp: TempDir,
}

#[derive(Clone, Debug)]
pub struct GitState {
    pub branch: Option<String>,
    pub sha: String,
    pub dirty: bool,
}

impl GitState {
    fn short_sha(&self) -> &str {
        let n = self.sha.len().min(7);
        &self.sha[..n]
    }
}

impl RunSnapshot {
    /// Create a snapshot containing `scenarios/<id>/assertions/` for each id in
    /// `scenario_ids` plus `packages/eval-core/src`. Captures git state for
    /// reporting.
    pub fn create(scenario_ids: &[String]) -> Result<Self> {
        let repo_root = preflight::resolve_repo_root()?;
        Self::create_from_root(&repo_root, scenario_ids)
    }

    /// Variant that takes the repo root explicitly. Lets tests build snapshots
    /// against a temp repo without mutating the process-wide cwd.
    pub fn create_from_root(repo_root: &Path, scenario_ids: &[String]) -> Result<Self> {
        let temp = tempfile::Builder::new()
            .prefix("dec-bench-snapshot-")
            .tempdir()
            .context("Failed to create snapshot tempdir")?;

        // Deduplicate while preserving stable order.
        let unique: BTreeSet<&String> = scenario_ids.iter().collect();
        let mut captured: Vec<String> = Vec::with_capacity(unique.len());

        for scenario_id in &unique {
            let src = repo_root
                .join("scenarios")
                .join(scenario_id.as_str())
                .join(ASSERTIONS_REL);
            if !src.exists() {
                bail!(
                    "Assertions directory missing for scenario '{scenario_id}': {} \
                     — cannot snapshot.",
                    src.display()
                );
            }
            let dst = temp
                .path()
                .join("scenarios")
                .join(scenario_id.as_str())
                .join(ASSERTIONS_REL);
            copy_dir_contents(&src, &dst)
                .with_context(|| format!("Failed to snapshot {}", src.display()))?;
            captured.push((*scenario_id).clone());
        }

        let eval_core_src = repo_root.join(EVAL_CORE_REL);
        if !eval_core_src.exists() {
            bail!(
                "eval-core source missing: {} — cannot snapshot.",
                eval_core_src.display()
            );
        }
        let eval_core_dst = temp.path().join(EVAL_CORE_REL);
        copy_dir_contents(&eval_core_src, &eval_core_dst)
            .with_context(|| format!("Failed to snapshot {}", eval_core_src.display()))?;

        let git = read_git_state(repo_root);

        Ok(Self {
            root: temp.path().to_path_buf(),
            git,
            captured_at: SystemTime::now(),
            scenario_ids: captured,
            _temp: temp,
        })
    }

    /// Path to the snapshotted `assertions/` for a scenario.
    pub fn assertions_dir(&self, scenario_id: &str) -> Result<PathBuf> {
        let path = self
            .root
            .join("scenarios")
            .join(scenario_id)
            .join(ASSERTIONS_REL);
        if !path.exists() {
            bail!(
                "Snapshot does not contain assertions for scenario '{scenario_id}'. \
                 This is a bug — the snapshot was taken without that scenario in scope."
            );
        }
        Ok(path)
    }

    /// Path to the snapshotted `packages/eval-core/src`.
    pub fn eval_core_src(&self) -> PathBuf {
        self.root.join(EVAL_CORE_REL)
    }

    /// Print the user-visible summary at run start. Always uses println! so it
    /// shows regardless of tracing config — Olivia's incident is the reason
    /// this exists, so it has to be visible.
    pub fn print_summary(&self) {
        println!("Snapshot: {}", self.root.display());
        match &self.git {
            Some(state) => {
                let branch = state.branch.as_deref().unwrap_or("(detached HEAD)");
                if state.dirty {
                    println!(
                        "  Branch: {} (sha={}, dirty=YES — testing uncommitted edits)",
                        branch,
                        state.short_sha()
                    );
                } else {
                    println!(
                        "  Branch: {} (sha={}, dirty=no)",
                        branch,
                        state.short_sha()
                    );
                }
            }
            None => println!("  Git: unavailable (snapshot still pinned to working tree at start)"),
        }
        let mut captured: Vec<String> = self
            .scenario_ids
            .iter()
            .map(|id| format!("scenarios/{id}/assertions"))
            .collect();
        captured.push(EVAL_CORE_REL.to_string());
        println!("  Captured: {}", captured.join(", "));
    }

    /// Manifest written into each per-run results dir as
    /// `<run_id>.snapshot.json`.
    pub fn manifest(&self) -> serde_json::Value {
        let captured_at = self
            .captured_at
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let captured_paths: Vec<String> = self
            .scenario_ids
            .iter()
            .map(|id| format!("scenarios/{id}/assertions"))
            .chain(std::iter::once(EVAL_CORE_REL.to_string()))
            .collect();
        let git = match &self.git {
            Some(state) => json!({
                "branch": state.branch,
                "sha": state.sha,
                "short_sha": state.short_sha(),
                "dirty": state.dirty,
            }),
            None => serde_json::Value::Null,
        };
        json!({
            "version": 1,
            "captured_at_unix": captured_at,
            "snapshot_root": self.root.display().to_string(),
            "git": git,
            "captured_paths": captured_paths,
        })
    }
}

fn copy_dir_contents(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)
        .with_context(|| format!("Failed to create {}", dst.display()))?;
    for entry in fs::read_dir(src)
        .with_context(|| format!("Failed to read {}", src.display()))?
    {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_contents(&entry.path(), &dst_path)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &dst_path).with_context(|| {
                format!(
                    "Failed to copy {} -> {}",
                    entry.path().display(),
                    dst_path.display()
                )
            })?;
        } else if file_type.is_symlink() {
            let target = fs::read_link(entry.path())?;
            std::os::unix::fs::symlink(&target, &dst_path).with_context(|| {
                format!(
                    "Failed to recreate symlink {} -> {}",
                    dst_path.display(),
                    target.display()
                )
            })?;
        }
    }
    Ok(())
}

fn read_git_state(repo_root: &Path) -> Option<GitState> {
    // We tolerate a missing/broken git binary — the snapshot itself is still
    // valid; we just can't label it.
    let sha = run_git(repo_root, &["rev-parse", "HEAD"])?;
    let branch = match run_git(repo_root, &["symbolic-ref", "--quiet", "--short", "HEAD"]) {
        Some(b) => Some(b),
        None => None,
    };
    // `git status --porcelain` prints nothing when the working tree is clean.
    // Empty output = clean. Any output = dirty. Treat git failure as "unknown
    // dirty state" → assume dirty so the user is warned, not silently misled.
    let dirty = match run_git_raw(repo_root, &["status", "--porcelain"]) {
        Some(out) => !out.trim().is_empty(),
        None => {
            warn!("git status failed during snapshot — flagging as dirty to be safe");
            true
        }
    };
    Some(GitState {
        branch,
        sha,
        dirty,
    })
}

fn run_git(repo_root: &Path, args: &[&str]) -> Option<String> {
    run_git_raw(repo_root, args).map(|s| s.trim().to_string())
}

fn run_git_raw(repo_root: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(path, content).expect("write");
    }

    #[test]
    fn copy_dir_contents_copies_files_and_subdirs() {
        let src = tempfile::tempdir().expect("src");
        let dst = tempfile::tempdir().expect("dst");
        write(&src.path().join("a.ts"), "a");
        write(&src.path().join("nested/b.ts"), "b");

        copy_dir_contents(src.path(), dst.path()).expect("copy");

        assert_eq!(fs::read_to_string(dst.path().join("a.ts")).unwrap(), "a");
        assert_eq!(
            fs::read_to_string(dst.path().join("nested/b.ts")).unwrap(),
            "b"
        );
    }

    #[test]
    fn create_snapshot_freezes_assertions_against_later_changes() {
        let repo = tempfile::tempdir().expect("repo");
        fs::create_dir_all(repo.path().join(".git")).expect(".git");
        let assertions = repo.path().join("scenarios/example/assertions");
        let eval_core = repo.path().join("packages/eval-core/src");
        write(&assertions.join("correct.ts"), "OLD");
        write(&eval_core.join("index.ts"), "core");

        let snapshot =
            RunSnapshot::create_from_root(repo.path(), &["example".to_string()]).expect("snapshot");
        // Mutate the live tree *after* snapshotting — must not affect the snapshot.
        write(&assertions.join("correct.ts"), "NEW");

        let snap_assertions = snapshot
            .assertions_dir("example")
            .expect("snapshot has assertions");
        let snap_content =
            fs::read_to_string(snap_assertions.join("correct.ts")).expect("read snap");
        assert_eq!(
            snap_content, "OLD",
            "snapshot must freeze contents at create time"
        );
    }

    #[test]
    fn create_snapshot_bails_when_assertions_missing() {
        let repo = tempfile::tempdir().expect("repo");
        fs::create_dir_all(repo.path().join(".git")).expect(".git");
        // packages/eval-core/src exists but assertions don't.
        write(&repo.path().join("packages/eval-core/src/index.ts"), "core");

        let result =
            RunSnapshot::create_from_root(repo.path(), &["missing-scenario".to_string()]);
        let err = match result {
            Ok(_) => panic!("expected snapshot creation to fail"),
            Err(e) => e,
        };
        let msg = err.to_string();
        assert!(
            msg.contains("Assertions directory missing"),
            "got: {msg}"
        );
    }

    #[test]
    fn manifest_includes_captured_paths() {
        let repo = tempfile::tempdir().expect("repo");
        fs::create_dir_all(repo.path().join(".git")).expect(".git");
        write(
            &repo.path().join("scenarios/foo/assertions/correct.ts"),
            "x",
        );
        write(&repo.path().join("packages/eval-core/src/index.ts"), "y");

        let snapshot =
            RunSnapshot::create_from_root(repo.path(), &["foo".to_string()]).expect("snapshot");

        let manifest = snapshot.manifest();
        let paths = manifest
            .get("captured_paths")
            .and_then(|v| v.as_array())
            .expect("captured_paths array");
        let strs: Vec<&str> = paths.iter().filter_map(|v| v.as_str()).collect();
        assert!(strs.contains(&"scenarios/foo/assertions"));
        assert!(strs.contains(&"packages/eval-core/src"));
    }
}
