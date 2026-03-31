use std::sync::LazyLock;

use regex::Regex;

use crate::types::ParsedClipboard;

static SK_KEY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(sk-[A-Za-z0-9_\-]{16,})").unwrap());
static XAI_KEY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(xai-[A-Za-z0-9_\-]{16,})").unwrap());
static CLAUDE_KEY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(claude-[A-Za-z0-9_\-]{16,})").unwrap());
static BASE_URL_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(https?://[^\s"']+)"#).unwrap());
static MODEL_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(gpt-[A-Za-z0-9\-.]+|claude-[A-Za-z0-9\-.]+)").unwrap());

pub fn parse_clipboard(input: &str) -> ParsedClipboard {
    let api_key_patterns = [&*SK_KEY_PATTERN, &*XAI_KEY_PATTERN, &*CLAUDE_KEY_PATTERN];

    let mut api_key = None;
    for pattern in api_key_patterns {
        if let Some(m) = pattern.find(input) {
            api_key = Some(m.as_str().to_string());
            break;
        }
    }

    let base_url = BASE_URL_PATTERN
        .find(input)
        .map(|m| m.as_str().trim_end_matches('/').to_string());
    let default_model = MODEL_PATTERN.find(input).map(|m| m.as_str().to_string());
    let provider = match api_key.as_deref() {
        Some(v) if v.starts_with("xai-") => Some("xai".to_string()),
        Some(v) if v.starts_with("sk-") => Some("openai-compatible".to_string()),
        Some(v) if v.starts_with("claude-") => Some("anthropic-compatible".to_string()),
        _ => None,
    };

    ParsedClipboard {
        provider,
        api_key,
        base_url,
        default_model,
    }
}

