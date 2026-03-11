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
fn create_then_registry_add_scenario_generates_registry_entry() {
    let scenario_workspace = tempdir().expect("temp dir");
    let out_registry = tempdir().expect("temp dir");

    let mut create_cmd = Command::cargo_bin("dec-bench").expect("binary");
    create_cmd
        .current_dir(repo_root())
        .arg("create")
        .arg("--name")
        .arg("integration-scenario")
        .arg("--domain")
        .arg("ugc")
        .arg("--tier")
        .arg("tier-2")
        .arg("--dir")
        .arg(scenario_workspace.path())
        .assert()
        .success();

    let scenario_dir = scenario_workspace.path().join("integration-scenario");
    let scenario_json_path = scenario_dir.join("scenario.json");
    let updated = serde_json::json!({
      "id": "integration-scenario",
      "title": "Integration Scenario",
      "description": "Integration flow test scenario",
      "tier": "tier-2",
      "domain": "ugc",
      "harness": "base-rt",
      "tasks": [
        {"id": "task-a", "description": "task", "category": "ingestion"}
      ],
      "personaPrompts": { "naive": "prompts/naive.md", "savvy": "prompts/savvy.md" },
      "tags": ["integration"],
      "baselineMetrics": {"queryLatencyMs": 1, "storageBytes": 1, "costPerQueryUsd": 1},
      "referenceMetrics": {"queryLatencyMs": 1, "storageBytes": 1, "costPerQueryUsd": 1}
    });
    fs::write(
        &scenario_json_path,
        format!("{}\n", serde_json::to_string_pretty(&updated).expect("json")),
    )
    .expect("write scenario json");

    let mut registry_cmd = Command::cargo_bin("dec-bench").expect("binary");
    registry_cmd
        .current_dir(repo_root())
        .arg("registry")
        .arg("add")
        .arg("--type")
        .arg("scenario")
        .arg("--scenario")
        .arg(&scenario_dir)
        .arg("--competencies")
        .arg("environment-setup")
        .arg("--features")
        .arg("performance-dashboards")
        .arg("--starting-state")
        .arg("greenfield")
        .arg("--services")
        .arg("postgres,clickhouse")
        .arg("--out")
        .arg(out_registry.path())
        .assert()
        .success()
        .stdout(predicate::str::contains("Created scenario registry entry"));

    let out_file = out_registry.path().join("integration-scenario.json");
    let raw = fs::read_to_string(out_file).expect("read registry output");
    let value: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
    assert_eq!(value["id"], "integration-scenario");
    assert_eq!(value["taskCount"], 1);
    assert_eq!(value["harnesses"][0], "base-rt");
}

#[test]
fn results_filter_only_returns_matching_scenario() {
    let temp = tempdir().expect("temp dir");
    fs::write(
        temp.path().join("one.json"),
        r#"{"scenario":"match-me","harness":"classic-de","highest_gate":2,"normalized_score":0.2}"#,
    )
    .expect("write file");
    fs::write(
        temp.path().join("two.json"),
        r#"{"scenario":"skip-me","harness":"classic-de","highest_gate":5,"normalized_score":0.9}"#,
    )
    .expect("write file");

    let mut cmd = Command::cargo_bin("dec-bench").expect("binary");
    cmd.current_dir(repo_root())
        .arg("results")
        .arg("--dir")
        .arg(temp.path())
        .arg("--scenario")
        .arg("match-me")
        .arg("--format")
        .arg("json");

    cmd.assert()
        .success()
        .stdout(predicate::str::contains("\"scenario\": \"match-me\""))
        .stdout(predicate::str::contains("skip-me").not());
}
