use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{bail, Context, Result};
use clap::{Args, Subcommand};
use tokio::time::{sleep, Duration};

use super::preflight;

#[derive(Args, Clone, Debug)]
pub struct AuditArgs {
    #[command(subcommand)]
    pub command: AuditCommand,
}

#[derive(Subcommand, Clone, Debug)]
pub enum AuditCommand {
    /// Export audit bundles from stored result files
    Export(ExportArgs),
    /// Export and open a specific audit run in the local web app
    Open(OpenArgs),
}

#[derive(Args, Clone, Debug)]
pub struct ExportArgs {
    /// Results directory to export from
    #[arg(long, default_value = "results")]
    pub results_dir: String,

    /// Explicit audits directory override
    #[arg(long)]
    pub audits_dir: Option<PathBuf>,

    /// Optional runtime logs directory
    #[arg(long)]
    pub logs_dir: Option<PathBuf>,

    /// Export only one scenario
    #[arg(long)]
    pub scenario: Option<String>,

    /// Export only one run ID
    #[arg(long = "run-id")]
    pub run_id: Option<String>,

    /// Overwrite existing audit bundles
    #[arg(long)]
    pub overwrite: bool,
}

#[derive(Args, Clone, Debug)]
pub struct OpenArgs {
    /// Scenario ID to open
    #[arg(long)]
    pub scenario: String,

    /// Run ID to open
    #[arg(long = "run-id")]
    pub run_id: String,

    /// Results directory to export from
    #[arg(long, default_value = "results")]
    pub results_dir: String,

    /// Explicit audits directory override
    #[arg(long)]
    pub audits_dir: Option<PathBuf>,

    /// Optional runtime logs directory
    #[arg(long)]
    pub logs_dir: Option<PathBuf>,

    /// Overwrite existing audit bundles
    #[arg(long)]
    pub overwrite: bool,

    /// Local port for the web app
    #[arg(long, default_value_t = 3000)]
    pub port: u16,

    /// Print the URL and export path without launching a browser or server
    #[arg(long)]
    pub dry_run: bool,
}

struct ExportPlan {
    repo_root: PathBuf,
    web_dir: PathBuf,
    audits_dir: PathBuf,
    manifest_path: Option<PathBuf>,
}

pub async fn execute(args: AuditArgs) -> Result<()> {
    match args.command {
        AuditCommand::Export(args) => export(args).await,
        AuditCommand::Open(args) => open(args).await,
    }
}

async fn export(args: ExportArgs) -> Result<()> {
    let plan = run_export(&args)?;
    println!("Audits directory: {}", plan.audits_dir.display());
    if let Some(manifest_path) = plan.manifest_path {
        if manifest_path.exists() {
            println!("Exported manifest: {}", manifest_path.display());
        }
    }
    Ok(())
}

async fn open(args: OpenArgs) -> Result<()> {
    let export_args = ExportArgs {
        results_dir: args.results_dir.clone(),
        audits_dir: args.audits_dir.clone(),
        logs_dir: args.logs_dir.clone(),
        scenario: Some(args.scenario.clone()),
        run_id: Some(args.run_id.clone()),
        overwrite: args.overwrite,
    };
    let plan = run_export(&export_args)?;
    let url = format!("http://localhost:{}/audit/{}/{}", args.port, args.scenario, args.run_id);

    println!("Audit manifest: {}", plan
        .manifest_path
        .as_ref()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "unknown".to_string()));
    println!("Audit URL: {}", url);

    if args.dry_run {
        println!("Dry run: skipping web server startup and browser launch.");
        return Ok(());
    }

    if !is_port_open(args.port) {
        start_web_server(&plan.web_dir, &plan.audits_dir, &resolve_results_dir(&plan.repo_root, &args.results_dir)?, args.port)?;
        wait_for_port(args.port).await?;
    }

    open_url(&url)?;
    Ok(())
}

fn run_export(args: &ExportArgs) -> Result<ExportPlan> {
    preflight::check_node()?;
    let repo_root = preflight::resolve_repo_root()?;
    let web_dir = repo_root.join("apps/web");
    let script_path = web_dir.join("scripts/export-audit-bundles.mjs");
    preflight::ensure_exists(&script_path, "Audit export script")?;

    let results_dir = resolve_results_dir(&repo_root, &args.results_dir)?;
    let audits_dir = resolve_audits_dir(&repo_root, &results_dir, args.audits_dir.as_ref());
    let logs_dir = resolve_optional_path(&repo_root, args.logs_dir.as_ref());

    let mut command_args = vec![
        "./scripts/export-audit-bundles.mjs".to_string(),
        "--results-dir".to_string(),
        results_dir.display().to_string(),
        "--audits-dir".to_string(),
        audits_dir.display().to_string(),
    ];
    if let Some(logs_dir) = &logs_dir {
        command_args.push("--logs-dir".to_string());
        command_args.push(logs_dir.display().to_string());
    }
    if let Some(scenario) = &args.scenario {
        command_args.push("--scenario".to_string());
        command_args.push(scenario.clone());
    }
    if let Some(run_id) = &args.run_id {
        command_args.push("--run-id".to_string());
        command_args.push(run_id.clone());
    }
    if args.overwrite {
        command_args.push("--overwrite".to_string());
    }

    let status = Command::new("node")
        .args(&command_args)
        .current_dir(&web_dir)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .with_context(|| format!("Failed to run {}", script_path.display()))?;

    if !status.success() {
        bail!(
            "Audit export failed with exit status {}",
            status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        );
    }

    let manifest_path = match (&args.scenario, &args.run_id) {
        (Some(scenario), Some(run_id)) => {
            let manifest_path = audits_dir.join(scenario).join(run_id).join("manifest.json");
            if !manifest_path.exists() {
                bail!(
                    "Expected exported manifest was not created: {}",
                    manifest_path.display()
                );
            }
            Some(manifest_path)
        }
        _ => None,
    };

    Ok(ExportPlan {
        repo_root,
        web_dir,
        audits_dir,
        manifest_path,
    })
}

fn resolve_results_dir(repo_root: &Path, input: &str) -> Result<PathBuf> {
    let raw = PathBuf::from(input);
    let resolved = if raw.is_absolute() { raw } else { repo_root.join(raw) };
    Ok(resolved)
}

fn resolve_audits_dir(repo_root: &Path, results_dir: &Path, explicit: Option<&PathBuf>) -> PathBuf {
    if let Some(path) = explicit {
        return resolve_path(repo_root, path);
    }
    results_dir.join("audits")
}

fn resolve_optional_path(repo_root: &Path, input: Option<&PathBuf>) -> Option<PathBuf> {
    input.map(|path| resolve_path(repo_root, path))
}

fn resolve_path(repo_root: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        repo_root.join(path)
    }
}

fn is_port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

async fn wait_for_port(port: u16) -> Result<()> {
    for _ in 0..60 {
        if is_port_open(port) {
            return Ok(());
        }
        sleep(Duration::from_millis(500)).await;
    }
    bail!("Timed out waiting for local web server on port {}", port)
}

fn start_web_server(web_dir: &Path, audits_dir: &Path, results_dir: &Path, port: u16) -> Result<()> {
    let mut command = Command::new("pnpm");
    command
        .arg("dev")
        .arg("--")
        .arg("--port")
        .arg(port.to_string())
        .current_dir(web_dir)
        .env("DEC_BENCH_AUDITS_DIR", audits_dir)
        .env("DEC_BENCH_RESULTS_DIR", results_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    command
        .spawn()
        .with_context(|| format!("Failed to start local web app in {}", web_dir.display()))?;
    Ok(())
}

fn open_url(url: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(url);
        cmd
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(url);
        cmd
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("rundll32");
        cmd.arg("url.dll,FileProtocolHandler").arg(url);
        cmd
    };

    let status = command
        .status()
        .with_context(|| format!("Failed to open browser for {}", url))?;
    if !status.success() {
        bail!("Browser open command failed for {}", url);
    }
    Ok(())
}
