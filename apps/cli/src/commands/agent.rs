use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};

/// A supported agent runner. Single source of truth for slugs, required API
/// keys, compatible model prefixes, and matrix defaults.
///
/// Every method is an exhaustive `match self`. Adding a variant here forces
/// compile errors at every match site until the implementation is complete.
/// `EnumIter` ensures `iter()` automatically covers the new variant —
/// no manual list to forget.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, clap::ValueEnum, strum::EnumIter)]
#[clap(rename_all = "kebab-case")]
pub enum Agent {
    ClaudeCode,
    Codex,
    Cursor,
}

impl Agent {
    /// The string identifier used in CLI args, image tags, env vars, and
    /// `docker/agents/<slug>/run.sh` directory names.
    pub const fn slug(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude-code",
            Self::Codex => "codex",
            Self::Cursor => "cursor",
        }
    }

    /// API key env var names this agent requires.
    pub const fn required_keys(self) -> &'static [&'static str] {
        match self {
            Self::ClaudeCode => &["ANTHROPIC_API_KEY"],
            Self::Codex => &["OPENAI_API_KEY"],
            Self::Cursor => &["CURSOR_API_KEY"],
        }
    }

    /// Model name prefixes this agent accepts.
    pub const fn model_prefixes(self) -> &'static [&'static str] {
        match self {
            Self::ClaudeCode => &["claude-"],
            Self::Codex => &["gpt-", "o"],
            Self::Cursor => &["composer-"],
        }
    }

    /// Default models used in matrix runs when no explicit agent:model list is given.
    /// Most agents have one default; claude-code benchmarks two by default.
    pub const fn default_models(self) -> &'static [&'static str] {
        match self {
            Self::ClaudeCode => &["claude-sonnet-4-6", "claude-opus-4-6"],
            Self::Codex => &["gpt-5.4"],
            Self::Cursor => &["composer-2"],
        }
    }

    /// Iterate over every variant. Backed by `EnumIter` — adding a variant
    /// here automatically includes it; no manual list to maintain.
    pub fn all() -> impl Iterator<Item = Self> {
        use strum::IntoEnumIterator;
        Self::iter()
    }
}

impl FromStr for Agent {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::all()
            .find(|a| a.slug() == s)
            .ok_or_else(|| {
                let known = Self::all()
                    .map(|a| a.slug())
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("Unknown agent '{s}'. Available agents: {known}")
            })
    }
}

impl fmt::Display for Agent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.slug())
    }
}

/// The API provider whose key we're validating. Separate from `Agent` because
/// the same provider may back multiple agents in the future.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ProviderKey {
    Anthropic,
    OpenAi,
    Cursor,
}

impl ProviderKey {
    /// Construct from the env var name. Returns `None` for unknown key names
    /// (e.g. keys we intentionally skip rather than validate).
    pub fn from_key_name(name: &str) -> Option<Self> {
        match name {
            "ANTHROPIC_API_KEY" | "ANTHROPIC_API_KEYS" => Some(Self::Anthropic),
            "OPENAI_API_KEY" | "OPENAI_API_KEYS" => Some(Self::OpenAi),
            "CURSOR_API_KEY" | "CURSOR_API_KEYS" => Some(Self::Cursor),
            _ => None,
        }
    }

    pub const fn api_url(self) -> &'static str {
        match self {
            Self::Anthropic => "https://api.anthropic.com/v1/models",
            Self::OpenAi => "https://api.openai.com/v1/models",
            Self::Cursor => "https://api.cursor.com/auth/verify",
        }
    }

    /// The single-key env var the agent reads inside a container.
    pub const fn singular_env(self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEY",
            Self::OpenAi => "OPENAI_API_KEY",
            Self::Cursor => "CURSOR_API_KEY",
        }
    }

    /// The plural, comma-separated env var the user can set on the host to
    /// give the CLI multiple keys to rotate across parallel runs.
    pub const fn plural_env(self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEYS",
            Self::OpenAi => "OPENAI_API_KEYS",
            Self::Cursor => "CURSOR_API_KEYS",
        }
    }

    pub fn all() -> impl Iterator<Item = Self> {
        [Self::Anthropic, Self::OpenAi, Self::Cursor].into_iter()
    }
}

/// A round-robin pool of API keys for one provider.
///
/// Built once from the host environment (plural `*_API_KEYS` if set, else the
/// singular `*_API_KEY`) and shared across the matrix run. `next()` is the
/// only mutator and uses an atomic counter so parallel tasks can pull keys
/// without locking.
#[derive(Debug)]
pub struct KeyPool {
    keys: Vec<String>,
    cursor: AtomicUsize,
}

impl KeyPool {
    /// Build the pool for `provider` from the host environment.
    ///
    /// Resolution order:
    /// 1. If `*_API_KEYS` is set and non-empty, parse comma-separated values
    ///    (whitespace trimmed, blanks dropped, duplicates removed).
    /// 2. Else if `*_API_KEY` is set and non-empty, treat as a list of one.
    /// 3. Else the pool is empty.
    pub fn from_env(provider: ProviderKey) -> Self {
        let plural = read_env_nonempty(provider.plural_env());
        let singular = read_env_nonempty(provider.singular_env());
        Self::from_raw(plural.as_deref(), singular.as_deref())
    }

    /// Pure constructor used by `from_env` and by tests. Public-in-crate so
    /// callers can build a pool without touching the process environment.
    pub(crate) fn from_raw(plural: Option<&str>, singular: Option<&str>) -> Self {
        let keys = parse_pool_keys(plural, singular);
        Self {
            keys,
            cursor: AtomicUsize::new(0),
        }
    }

    pub fn len(&self) -> usize {
        self.keys.len()
    }

    pub fn is_empty(&self) -> bool {
        self.keys.is_empty()
    }

    pub fn keys(&self) -> &[String] {
        &self.keys
    }

    /// Take the next key in round-robin order. Returns `None` if the pool is
    /// empty. Safe to call concurrently from many tasks.
    pub fn next(&self) -> Option<&str> {
        if self.keys.is_empty() {
            return None;
        }
        let idx = self.cursor.fetch_add(1, Ordering::Relaxed) % self.keys.len();
        Some(&self.keys[idx])
    }
}

/// All provider key pools, indexed by `ProviderKey`. Built once at the start
/// of `dec-bench run` and shared across all containers in the matrix.
#[derive(Debug)]
pub struct KeyPools {
    pools: HashMap<ProviderKey, KeyPool>,
}

impl KeyPools {
    pub fn from_env() -> Self {
        let pools = ProviderKey::all()
            .map(|p| (p, KeyPool::from_env(p)))
            .collect();
        Self { pools }
    }

    pub fn get(&self, provider: ProviderKey) -> &KeyPool {
        self.pools
            .get(&provider)
            .expect("KeyPools::from_env populates every provider")
    }

    /// Iterate over every (provider, pool) entry, including empty pools.
    pub fn iter(&self) -> impl Iterator<Item = (ProviderKey, &KeyPool)> {
        self.pools.iter().map(|(p, pool)| (*p, pool))
    }

    /// Every key value across every pool, for sanitization.
    pub fn all_secrets(&self) -> impl Iterator<Item = &str> {
        self.pools
            .values()
            .flat_map(|pool| pool.keys.iter().map(String::as_str))
    }

    /// Test-only constructor: build a `KeyPools` where `provider` has the
    /// given keys and every other provider is empty. Avoids touching the
    /// process env so parallel tests don't race.
    #[cfg(test)]
    pub(crate) fn for_test_one_provider(
        provider: ProviderKey,
        plural: Option<&str>,
        singular: Option<&str>,
    ) -> Self {
        let mut pools: HashMap<ProviderKey, KeyPool> = ProviderKey::all()
            .map(|p| (p, KeyPool::from_raw(None, None)))
            .collect();
        pools.insert(provider, KeyPool::from_raw(plural, singular));
        Self { pools }
    }
}

fn read_env_nonempty(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|v| !v.trim().is_empty())
}

fn parse_pool_keys(plural: Option<&str>, singular: Option<&str>) -> Vec<String> {
    if let Some(raw) = plural.map(str::trim).filter(|s| !s.is_empty()) {
        let mut keys: Vec<String> = Vec::new();
        for piece in raw.split(',') {
            let trimmed = piece.trim();
            if !trimmed.is_empty() && !keys.iter().any(|k| k == trimmed) {
                keys.push(trimmed.to_string());
            }
        }
        return keys;
    }
    if let Some(raw) = singular.map(str::trim).filter(|s| !s.is_empty()) {
        return vec![raw.to_string()];
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_round_trips_via_from_str() {
        for agent in Agent::all() {
            let parsed: Agent = agent.slug().parse().expect("slug should parse back");
            assert_eq!(parsed, agent);
        }
    }

    #[test]
    fn display_equals_slug() {
        for agent in Agent::all() {
            assert_eq!(agent.to_string(), agent.slug());
        }
    }

    #[test]
    fn unknown_agent_string_is_rejected() {
        let err = "cline".parse::<Agent>().unwrap_err();
        assert!(err.contains("Unknown agent 'cline'"));
        assert!(err.contains("claude-code"));
    }

    #[test]
    fn all_agents_have_nonempty_required_keys() {
        for agent in Agent::all() {
            assert!(!agent.required_keys().is_empty(), "{agent} has no required keys");
        }
    }

    #[test]
    fn all_agents_have_nonempty_model_prefixes() {
        for agent in Agent::all() {
            assert!(!agent.model_prefixes().is_empty(), "{agent} has no model prefixes");
        }
    }

    #[test]
    fn all_agents_have_nonempty_default_models() {
        for agent in Agent::all() {
            assert!(!agent.default_models().is_empty(), "{agent} has no default models");
        }
    }

    #[test]
    fn provider_key_round_trips() {
        for agent in Agent::all() {
            for key_name in agent.required_keys() {
                assert!(
                    ProviderKey::from_key_name(key_name).is_some(),
                    "key {key_name} (from {agent}) has no ProviderKey"
                );
            }
        }
    }

    #[test]
    fn provider_plural_singular_envs_distinct() {
        for provider in ProviderKey::all() {
            assert_ne!(provider.singular_env(), provider.plural_env());
            assert!(provider.singular_env().ends_with("_API_KEY"));
            assert!(provider.plural_env().ends_with("_API_KEYS"));
        }
    }

    #[test]
    fn from_key_name_accepts_plural_form() {
        assert_eq!(
            ProviderKey::from_key_name("ANTHROPIC_API_KEYS"),
            Some(ProviderKey::Anthropic)
        );
        assert_eq!(
            ProviderKey::from_key_name("OPENAI_API_KEYS"),
            Some(ProviderKey::OpenAi)
        );
        assert_eq!(
            ProviderKey::from_key_name("CURSOR_API_KEYS"),
            Some(ProviderKey::Cursor)
        );
    }

    #[test]
    fn pool_parses_singular_only() {
        let pool = KeyPool::from_raw(None, Some("sk-1"));
        assert_eq!(pool.keys(), &["sk-1".to_string()]);
    }

    #[test]
    fn pool_prefers_plural_over_singular() {
        let pool = KeyPool::from_raw(Some("sk-1,sk-2"), Some("sk-ignored"));
        assert_eq!(pool.keys(), &["sk-1".to_string(), "sk-2".to_string()]);
    }

    #[test]
    fn pool_trims_and_drops_blank_pieces() {
        let pool = KeyPool::from_raw(Some("  sk-1 , ,sk-2 ,  "), None);
        assert_eq!(pool.keys(), &["sk-1".to_string(), "sk-2".to_string()]);
    }

    #[test]
    fn pool_dedupes_duplicates() {
        let pool = KeyPool::from_raw(Some("sk-1,sk-2,sk-1,sk-2"), None);
        assert_eq!(pool.keys(), &["sk-1".to_string(), "sk-2".to_string()]);
    }

    #[test]
    fn pool_is_empty_when_nothing_set() {
        let pool = KeyPool::from_raw(None, None);
        assert!(pool.is_empty());
        assert_eq!(pool.next(), None);
    }

    #[test]
    fn pool_next_round_robins() {
        let pool = KeyPool::from_raw(Some("a,b,c"), None);
        let observed: Vec<&str> = (0..7).map(|_| pool.next().unwrap()).collect();
        assert_eq!(observed, vec!["a", "b", "c", "a", "b", "c", "a"]);
    }

    #[test]
    fn pool_falls_back_to_singular_when_plural_blank() {
        let pool = KeyPool::from_raw(Some("   "), Some("sk-only"));
        assert_eq!(pool.keys(), &["sk-only".to_string()]);
    }
}
