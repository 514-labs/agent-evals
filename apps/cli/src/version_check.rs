use std::io::{IsTerminal, Write};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tokio::task::JoinHandle;

const CURRENT: &str = env!("CARGO_PKG_VERSION");
const RELEASES_URL: &str = "https://api.github.com/repos/514-labs/agent-evals/releases/latest";
const CACHE_TTL: Duration = Duration::from_secs(60 * 60);
const HTTP_TIMEOUT: Duration = Duration::from_millis(1500);

#[derive(Serialize, Deserialize)]
struct CacheEntry {
    checked_at: u64,
    latest: String,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
}

fn cache_path() -> Option<PathBuf> {
    Some(
        dirs::cache_dir()?
            .join("dec-bench")
            .join("version_check.json"),
    )
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn read_cache() -> Option<CacheEntry> {
    let path = cache_path()?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_cache(latest: &str) {
    let Some(path) = cache_path() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let entry = CacheEntry {
        checked_at: now_secs(),
        latest: latest.to_string(),
    };
    if let Ok(raw) = serde_json::to_string(&entry) {
        let _ = std::fs::write(path, raw);
    }
}

fn newer_than_current(latest: &str) -> bool {
    let current = match semver::Version::parse(CURRENT) {
        Ok(v) => v,
        Err(_) => return false,
    };
    let latest = match semver::Version::parse(latest.trim_start_matches('v')) {
        Ok(v) => v,
        Err(_) => return false,
    };
    latest > current
}

async fn fetch_latest() -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent(concat!("dec-bench/", env!("CARGO_PKG_VERSION")))
        .build()
        .ok()?;
    let resp = client.get(RELEASES_URL).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.text().await.ok()?;
    let release: GithubRelease = serde_json::from_str(&body).ok()?;
    let tag = release.tag_name.trim_start_matches('v').to_string();
    Some(tag)
}

pub enum CheckHandle {
    /// Result already known synchronously (cache hit or feature disabled).
    Resolved(Option<String>),
    /// Network fetch in flight on the runtime.
    Pending(JoinHandle<Option<String>>),
}

/// Decide synchronously whether we already know the answer (cache hit or
/// disabled by env var); otherwise spawn a background fetch. The inner
/// `Option<String>` is the latest version string if (and only if) it is
/// strictly newer than the running binary.
///
/// `force_fresh = true` skips the cache and always hits the network.
pub fn spawn_check(force_fresh: bool) -> CheckHandle {
    if std::env::var_os("DEC_BENCH_NO_UPDATE_CHECK").is_some() {
        return CheckHandle::Resolved(None);
    }

    if !force_fresh {
        if let Some(entry) = read_cache() {
            let age = now_secs().saturating_sub(entry.checked_at);
            if age < CACHE_TTL.as_secs() {
                return CheckHandle::Resolved(
                    newer_than_current(&entry.latest).then_some(entry.latest),
                );
            }
        }
    }

    CheckHandle::Pending(tokio::spawn(async move {
        let latest = fetch_latest().await?;
        write_cache(&latest);
        newer_than_current(&latest).then_some(latest)
    }))
}

/// Resolve the check and print an update banner to stderr if a newer version
/// is known. When a network fetch is in flight, prints a one-line
/// "Checking for updates..." status and clears it on TTYs once done.
pub async fn print_if_ready(handle: CheckHandle) {
    let result = match handle {
        CheckHandle::Resolved(r) => r,
        CheckHandle::Pending(task) => {
            let mut stderr = std::io::stderr();
            let _ = write!(stderr, "Checking for updates...");
            let _ = stderr.flush();
            let r = task.await.ok().flatten();
            if stderr.is_terminal() {
                let _ = write!(stderr, "\r\x1b[2K");
            } else {
                let _ = writeln!(stderr);
            }
            let _ = stderr.flush();
            r
        }
    };

    let Some(latest) = result else { return };
    eprintln!();
    eprintln!(
        "A new version of dec-bench is available: {} -> {}",
        CURRENT, latest
    );
    eprintln!("Update: curl -fsSL https://decbench.ai/install.sh | sh");
}
