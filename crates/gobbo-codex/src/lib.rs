//! Codex bridge types and protocol primitives.

/// Reasoning depth requested from the Codex backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ThinkingLevel {
    Off,
    Minimal,
    Low,
    #[default]
    Medium,
    High,
}

impl ThinkingLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            ThinkingLevel::Off => "off",
            ThinkingLevel::Minimal => "minimal",
            ThinkingLevel::Low => "low",
            ThinkingLevel::Medium => "medium",
            ThinkingLevel::High => "high",
        }
    }
}

/// Reason the Codex turn stopped.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StopReason {
    EndTurn,
    ToolCalls,
    MaxTokens,
    Refusal,
}

/// Token usage reported by Codex at the end of a turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TokenUsage {
    pub prompt: u64,
    pub completion: u64,
    pub reasoning: u64,
}

impl TokenUsage {
    pub fn total(&self) -> u64 {
        self.prompt + self.completion + self.reasoning
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thinking_level_renders_as_kebab_string() {
        assert_eq!(ThinkingLevel::Medium.as_str(), "medium");
        assert_eq!(ThinkingLevel::default().as_str(), "medium");
    }

    #[test]
    fn token_usage_totals_correctly() {
        let u = TokenUsage {
            prompt: 100,
            completion: 50,
            reasoning: 20,
        };
        assert_eq!(u.total(), 170);
    }
}
