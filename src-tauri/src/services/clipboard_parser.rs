use regex::Regex;

use crate::types::ParsedClipboard;

pub fn parse_clipboard(input: &str) -> ParsedClipboard {
    let api_key_patterns = vec![
        Regex::new(r"(sk-[A-Za-z0-9_\-]{16,})").expect("valid regex"),
        Regex::new(r"(xai-[A-Za-z0-9_\-]{16,})").expect("valid regex"),
        Regex::new(r"(claude-[A-Za-z0-9_\-]{16,})").expect("valid regex"),
    ];
    let base_url_pattern = Regex::new(r#"(https?://[^\s"']+)"#).expect("valid regex");
    let model_pattern = Regex::new(r"(gpt-[A-Za-z0-9\-.]+|claude-[A-Za-z0-9\-.]+)")
        .expect("valid regex");

    let mut api_key = None;
    for pattern in api_key_patterns {
        if let Some(m) = pattern.find(input) {
            api_key = Some(m.as_str().to_string());
            break;
        }
    }

    let base_url = base_url_pattern
        .find(input)
        .map(|m| m.as_str().trim_end_matches('/').to_string());
    let default_model = model_pattern.find(input).map(|m| m.as_str().to_string());
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

