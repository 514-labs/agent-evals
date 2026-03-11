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

fn write_result_fixture(dir: &std::path::Path, scenario: &str, run_id: &str) {
    let result_path = dir.join(format!("{run_id}.json"));
    fs::write(
        &result_path,
        format!(
            r#"{{
  "run_id": "{run_id}",
  "scenario": "{scenario}",
  "harness": "base-rt",
  "agent": "claude-code",
  "model": "claude-sonnet-4-20250514",
  "version": "v-test",
  "highest_gate": 3,
  "normalized_score": 0.75,
  "gates": {{}},
  "efficiency": {{
    "wallClockSeconds": 12,
    "agentSteps": 4,
    "tokensUsed": 123,
    "llmApiCostUsd": 0.12
  }}
}}"#
        ),
    )
    .expect("write result file");
    fs::write(dir.join(format!("{run_id}.stdout")), "run stdout\n").expect("write stdout");
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
fn results_command_latest_prints_artifact_paths() {
    let temp = tempdir().expect("temp dir");
    write_result_fixture(temp.path(), "foo-bar-csv-ingest", "foo-bar-csv-ingest-1770000000");
    fs::write(
        temp.path().join("foo-bar-csv-ingest-1770000000.trace.json"),
        "{}\n",
    )
    .expect("write trace");

    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("results")
        .arg("--dir")
        .arg(temp.path())
        .arg("--latest")
        .arg("--scenario")
        .arg("foo-bar-csv-ingest");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Run ID: foo-bar-csv-ingest-1770000000"))
        .stdout(predicate::str::contains("stdout:"))
        .stdout(predicate::str::contains("trace:"));
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
fn build_command_supports_dry_run_for_existing_inputs() {
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("build")
        .arg("--scenario")
        .arg("foo-bar-csv-ingest")
        .arg("--harness")
        .arg("base-rt")
        .arg("--agent")
        .arg("claude-code")
        .arg("--model")
        .arg("claude-sonnet-4-20250514")
        .arg("--version")
        .arg("v-test")
        .arg("--dry-run");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Dry run: would invoke"))
        .stdout(predicate::str::contains("Final image tag: foo-bar-csv-ingest.base-rt.claude-code.claude-sonnet-4-20250514.v-test"));
}

#[test]
fn validate_command_reports_scaffold_gaps_after_create() {
    let temp = tempdir().expect("temp dir");

    let mut create_cmd = Command::cargo_bin("dec-bench").expect("binary");
    create_cmd
        .current_dir(repo_root())
        .arg("create")
        .arg("--name")
        .arg("validate-me")
        .arg("--domain")
        .arg("ugc")
        .arg("--tier")
        .arg("tier-1")
        .arg("--dir")
        .arg(temp.path())
        .assert()
        .success();

    let scenario_root = temp.path().join("validate-me");
    let mut validate_cmd = Command::cargo_bin("dec-bench").expect("binary");
    validate_cmd
        .current_dir(repo_root())
        .arg("validate")
        .arg("--scenario")
        .arg(&scenario_root)
        .arg("--format")
        .arg("json");

    validate_cmd
        .assert()
        .failure()
        .stdout(predicate::str::contains("\"passed\": false"))
        .stdout(predicate::str::contains("must include a non-empty `title`"))
        .stderr(predicate::str::contains("Validation failed"));
}

#[test]
fn validate_command_accepts_existing_scenario_with_registry_inputs() {
    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("validate")
        .arg("--scenario")
        .arg("foo-bar-csv-ingest")
        .arg("--competencies")
        .arg("data-ingestion-and-integration")
        .arg("--features")
        .arg("")
        .arg("--starting-state")
        .arg("greenfield")
        .arg("--services")
        .arg("clickhouse")
        .arg("--format")
        .arg("json");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("\"passed\": true"))
        .stdout(predicate::str::contains("\"registry_ready\": true"));
}

#[test]
fn audit_export_command_writes_manifest_for_target_run() {
    let results_dir = tempdir().expect("results dir");
    let audits_dir = tempdir().expect("audits dir");
    write_result_fixture(results_dir.path(), "foo-bar-csv-ingest", "foo-bar-csv-ingest-run1");

    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("audit")
        .arg("export")
        .arg("--results-dir")
        .arg(results_dir.path())
        .arg("--audits-dir")
        .arg(audits_dir.path())
        .arg("--scenario")
        .arg("foo-bar-csv-ingest")
        .arg("--run-id")
        .arg("foo-bar-csv-ingest-run1");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("Exported manifest:"));

    assert!(
        audits_dir
            .path()
            .join("foo-bar-csv-ingest/foo-bar-csv-ingest-run1/manifest.json")
            .exists()
    );
}

#[test]
fn audit_open_dry_run_prints_target_url() {
    let results_dir = tempdir().expect("results dir");
    let audits_dir = tempdir().expect("audits dir");
    write_result_fixture(results_dir.path(), "foo-bar-csv-ingest", "foo-bar-csv-ingest-run2");

    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("audit")
        .arg("open")
        .arg("--scenario")
        .arg("foo-bar-csv-ingest")
        .arg("--run-id")
        .arg("foo-bar-csv-ingest-run2")
        .arg("--results-dir")
        .arg(results_dir.path())
        .arg("--audits-dir")
        .arg(audits_dir.path())
        .arg("--dry-run");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains(
            "Audit URL: http://localhost:3000/audit/foo-bar-csv-ingest/foo-bar-csv-ingest-run2",
        ))
        .stdout(predicate::str::contains("Dry run: skipping web server startup and browser launch."));
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
