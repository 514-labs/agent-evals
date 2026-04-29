use std::fmt;
use std::str::FromStr;

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
        Self::all().find(|a| a.slug() == s).ok_or_else(|| {
            let known = Self::all().map(|a| a.slug()).collect::<Vec<_>>().join(", ");
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
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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
            "ANTHROPIC_API_KEY" => Some(Self::Anthropic),
            "OPENAI_API_KEY" => Some(Self::OpenAi),
            "CURSOR_API_KEY" => Some(Self::Cursor),
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
            assert!(
                !agent.required_keys().is_empty(),
                "{agent} has no required keys"
            );
        }
    }

    #[test]
    fn all_agents_have_nonempty_model_prefixes() {
        for agent in Agent::all() {
            assert!(
                !agent.model_prefixes().is_empty(),
                "{agent} has no model prefixes"
            );
        }
    }

    #[test]
    fn all_agents_have_nonempty_default_models() {
        for agent in Agent::all() {
            assert!(
                !agent.default_models().is_empty(),
                "{agent} has no default models"
            );
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
}
