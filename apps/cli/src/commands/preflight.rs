use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use anyhow::{bail, Context, Result};
use bollard::Docker;
use bollard::API_DEFAULT_VERSION;

use super::agent::{Agent, KeyPools, ProviderKey};

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
    let output = Command::new("docker")
        .arg("info")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(o) if o.status.success() => Ok(()),
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            let detail = stderr.trim();
            if detail.is_empty() {
                bail!(
                    "Docker is installed but the daemon is not running.\n\n\
                     Start Docker Desktop or the Docker daemon, then try again."
                );
            } else {
                bail!(
                    "Docker is installed but the daemon is not running.\n\n\
                     docker info reported:\n  {detail}\n\n\
                     Start Docker Desktop or the Docker daemon, then try again."
                );
            }
        }
        Err(_) => bail!(
            "Docker is not installed or not in your PATH.\n\n\
             Install Docker: https://docs.docker.com/get-docker/"
        ),
    }
}

/// Resolve the Docker daemon endpoint using Docker CLI context resolution.
///
/// Returns `None` when bollard's `connect_with_local_defaults` is sufficient
/// (i.e. `DOCKER_HOST` is already set, or context inspection fails).
pub fn resolve_docker_host() -> Option<String> {
    // If DOCKER_HOST is explicitly set, bollard already handles it.
    if std::env::var("DOCKER_HOST")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .is_some()
    {
        return None;
    }

    let output = Command::new("docker")
        .args(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let host = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

/// Connect to the Docker daemon, respecting Docker CLI context configuration.
///
/// Needed for Colima and other setups where the socket is not at the default
/// `/var/run/docker.sock` path. Falls back to bollard defaults when context
/// resolution is unnecessary or fails.
pub fn connect_docker() -> Result<Docker> {
    if let Some(host) = resolve_docker_host() {
        if let Some(socket_path) = host.strip_prefix("unix://") {
            return Docker::connect_with_socket(socket_path, 120, API_DEFAULT_VERSION).context(
                format!("Failed to connect to Docker socket at '{socket_path}' (from context)"),
            );
        }
        if host.starts_with("tcp://") || host.starts_with("http://") {
            return Docker::connect_with_http(&host, 120, API_DEFAULT_VERSION)
                .context(format!("Failed to connect to Docker at '{host}' (from context)"));
        }
        tracing::warn!(
            "Docker context returned unrecognized host '{}'; falling back to defaults",
            host
        );
    }

    Docker::connect_with_local_defaults().context("Failed to connect to Docker daemon")
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

/// Validate agent/model compatibility and API keys for one or more pairs.
/// Call this at the **start** of `execute()` so problems surface before any
/// Docker builds or container launches.
///
/// Checks run in order: model compatibility → key presence (the provider's
/// `KeyPool` must be non-empty) → key validity (live API call against every
/// key in the relevant pools, in parallel). Earlier failures short-circuit so
/// we don't spam users with redundant errors.
pub async fn validate_agent_model_keys(
    pairs: &[(Agent, &str)],
    key_pools: &KeyPools,
) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();
    let mut providers_to_validate: HashSet<ProviderKey> = HashSet::new();

    for (agent, model) in pairs {
        // 1. Model must be compatible with the agent
        let prefixes = agent.model_prefixes();
        if !prefixes.iter().any(|p| model.starts_with(p)) {
            let examples = prefixes
                .iter()
                .map(|p| format!("{p}*"))
                .collect::<Vec<_>>()
                .join(", ");
            errors.push(format!(
                "Model '{model}' is not compatible with agent '{agent}'. \
                 Expected model matching: {examples}"
            ));
        }

        // 2. Required provider must have at least one key in its pool.
        for key_name in agent.required_keys() {
            let Some(provider) = ProviderKey::from_key_name(key_name) else {
                continue;
            };
            let pool = key_pools.get(provider);
            if pool.is_empty() {
                errors.push(format!(
                    "Missing {} (required by agent '{agent}'). Set one of:\n\n\
                     \texport {}=<your-key>\n\
                     \texport {}=<key1>,<key2>,...",
                    provider.singular_env(),
                    provider.singular_env(),
                    provider.plural_env(),
                ));
            } else {
                providers_to_validate.insert(provider);
            }
        }
    }

    // Bail early with structural errors before making network calls.
    if !errors.is_empty() {
        errors.dedup();
        bail!(
            "Preflight validation failed:\n\n{}",
            format_errors(&errors)
        );
    }

    // 3. Validate every key in every relevant pool against the provider API
    //    (in parallel). One bad key in a pool fails the whole run — a quietly
    //    rotated-out key would otherwise surface as a flaky 401 mid-matrix.
    let mut key_errors: Vec<String> = Vec::new();
    let mut handles = Vec::new();

    for provider in providers_to_validate {
        let pool = key_pools.get(provider);
        for (idx, value) in pool.keys().iter().enumerate() {
            let label = if pool.len() > 1 {
                format!("{}[{}]", provider.singular_env(), idx)
            } else {
                provider.singular_env().to_string()
            };
            let value = value.clone();
            handles.push(tokio::spawn(async move {
                validate_api_key_value(provider, &label, &value).await
            }));
        }
    }
    for handle in handles {
        if let Ok(Err(msg)) = handle.await {
            key_errors.push(msg);
        }
    }

    if !key_errors.is_empty() {
        key_errors.sort();
        bail!(
            "Preflight validation failed:\n\n{}",
            format_errors(&key_errors)
        );
    }

    Ok(())
}

fn format_errors(errors: &[String]) -> String {
    errors
        .iter()
        .enumerate()
        .map(|(i, e)| format!("  {}. {e}", i + 1))
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Hit a lightweight provider endpoint to confirm the key authenticates.
/// Returns `Ok(())` on success, `Err(message)` on auth failure. The `label`
/// is used purely for the error message — it can be either the bare env var
/// name (e.g. `ANTHROPIC_API_KEY`) or an indexed form for pools
/// (e.g. `ANTHROPIC_API_KEY[2]`).
async fn validate_api_key_value(
    provider: ProviderKey,
    label: &str,
    value: &str,
) -> std::result::Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let url = provider.api_url();
    let request = match provider {
        ProviderKey::Anthropic => client
            .get(url)
            .header("x-api-key", value)
            .header("anthropic-version", "2023-06-01"),
        ProviderKey::OpenAi => client.get(url).bearer_auth(value),
        ProviderKey::Cursor => {
            // Cursor uses Basic Auth with the API key as the username.
            client.get(url).basic_auth(value, Option::<&str>::None)
        }
    };

    match request.send().await {
        Ok(resp) if resp.status().is_success() => Ok(()),
        Ok(resp) if resp.status().as_u16() == 401 || resp.status().as_u16() == 403 => {
            Err(format!(
                "{label} is set but invalid — got HTTP {} from {url}. \
                 Check that the key is correct and has not expired.",
                resp.status()
            ))
        }
        Ok(resp) => {
            tracing::warn!(
                "{label} validation returned HTTP {} from {url} — skipping check",
                resp.status()
            );
            Ok(())
        }
        Err(e) if e.is_timeout() || e.is_connect() => {
            tracing::warn!("{label} validation failed (network): {e} — skipping check");
            Ok(())
        }
        Err(e) => {
            tracing::warn!("{label} validation failed: {e} — skipping check");
            Ok(())
        }
    }
}

/// Convenience wrapper used by tests and any caller that has a single key by
/// env-var name. Skips silently for unknown names (e.g. POSTGRES_URL).
#[cfg(test)]
async fn validate_api_key(key_name: &str, value: &str) -> std::result::Result<(), String> {
    let Some(provider) = ProviderKey::from_key_name(key_name) else {
        return Ok(());
    };
    validate_api_key_value(provider, key_name, value).await
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

pub fn check_pnpm() -> Result<()> {
    let status = Command::new("pnpm")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => Ok(()),
        _ => bail!(
            "pnpm is not installed or not in your PATH.\n\n\
             Install pnpm before using `dec-bench audit open`:\n\n\
             \tnpm install -g pnpm"
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

    fn pools_with(provider: ProviderKey, plural: Option<&str>, singular: Option<&str>) -> KeyPools {
        // Build a KeyPools without touching the process env, so concurrent
        // tests don't fight over `ANTHROPIC_API_KEY` etc. The pool for
        // `provider` gets the supplied values; every other provider stays
        // empty.
        KeyPools::for_test_one_provider(provider, plural, singular)
    }

    #[tokio::test]
    async fn incompatible_model_is_rejected() {
        let pools = pools_with(ProviderKey::Anthropic, None, Some("sk-test"));
        let result =
            validate_agent_model_keys(&[(Agent::ClaudeCode, "gpt-5.4")], &pools).await;
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("not compatible"));
    }

    // NOTE: env-var-mutating tests use CURSOR_API_KEY to avoid conflicts
    // with other tests that touch ANTHROPIC_API_KEY / OPENAI_API_KEY.
    // Cursor has no live validation endpoint, so these only exercise the
    // structural checks (presence, agent/model compat) without network calls.

    #[tokio::test]
    async fn compatible_model_with_key_set() {
        let pools = pools_with(ProviderKey::Cursor, None, Some("sk-test-key"));
        let result =
            validate_agent_model_keys(&[(Agent::Cursor, "composer-2")], &pools).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn missing_key_is_rejected() {
        let pools = pools_with(ProviderKey::Cursor, None, None); // no anthropic key set
        let result =
            validate_agent_model_keys(&[(Agent::ClaudeCode, "claude-sonnet-4-6")], &pools).await;
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("ANTHROPIC_API_KEY"));
        assert!(msg.contains("ANTHROPIC_API_KEYS"));
    }

    #[tokio::test]
    async fn multiple_errors_reported_together() {
        // codex + claude model = wrong model AND missing key
        let pools = pools_with(ProviderKey::Cursor, None, None); // no openai key set
        let result =
            validate_agent_model_keys(&[(Agent::Codex, "claude-sonnet-4-6")], &pools).await;
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("not compatible"));
        assert!(msg.contains("OPENAI_API_KEY"));
    }

    #[tokio::test]
    async fn plural_only_satisfies_key_presence() {
        let pools =
            pools_with(ProviderKey::Cursor, Some("sk-a,sk-b,sk-c"), None);
        let result =
            validate_agent_model_keys(&[(Agent::Cursor, "composer-2")], &pools).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn invalid_api_key_is_rejected() {
        let result = validate_api_key("ANTHROPIC_API_KEY", "sk-ant-clearly-bogus-key").await;
        // Should fail with 401 if network is available, or Ok if offline.
        // Either way it shouldn't panic.
        if let Err(msg) = &result {
            assert!(msg.contains("invalid"), "Expected auth error, got: {msg}");
        }
    }
}
