use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

fn repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .expect("repo root")
        .to_path_buf()
}

#[test]
fn create_command_generates_scenario_scaffold() {
    let temp = tempdir().expect("temp dir");
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("create")
        .arg("--name")
        .arg("cli-e2e-scenario")
        .arg("--domain")
        .arg("ugc")
        .arg("--tier")
        .arg("tier-1")
        .arg("--dir")
        .arg(temp.path());

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Created scenario at"));

    let scenario_root = temp.path().join("cli-e2e-scenario");
    assert!(scenario_root.join("scenario.json").exists());
    assert!(scenario_root.join("assertions/functional.ts").exists());
}

#[test]
fn results_command_outputs_json_for_result_files() {
    let temp = tempdir().expect("temp dir");
    fs::write(
        temp.path().join("res.json"),
        r#"{"scenario":"ecommerce-pipeline-recovery","harness":"classic-de","highest_gate":3,"normalized_score":0.74}"#,
    )
    .expect("write result");

    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("results")
        .arg("--dir")
        .arg(temp.path())
        .arg("--format")
        .arg("json");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("\"scenario\": \"ecommerce-pipeline-recovery\""));
}

#[test]
fn registry_add_harness_writes_json_entry() {
    let temp = tempdir().expect("temp dir");
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("registry")
        .arg("add")
        .arg("--type")
        .arg("harness")
        .arg("--id")
        .arg("cli-test-harness")
        .arg("--title")
        .arg("CLI Test Harness")
        .arg("--description")
        .arg("Harness for CLI tests")
        .arg("--install-script")
        .arg("pip3 install --no-cache-dir dbt-core==1.10.19 dbt-postgres==1.10.0")
        .arg("--network-policy")
        .arg("open")
        .arg("--out")
        .arg(temp.path());

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Created harness registry entry"));

    let out_file = temp.path().join("cli-test-harness.json");
    assert!(out_file.exists());
}

#[test]
fn run_command_requires_scenario_when_not_matrix() {
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root()).arg("run");

    cmd.assert()
        .failure()
        .stderr(predicate::str::contains("--scenario is required unless --matrix is enabled"));
}

#[test]
fn list_command_prints_available_scenarios() {
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root()).arg("list");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Available scenarios:"))
        .stdout(predicate::str::contains("b2b-mrr-waterfall-metrics"));
}
