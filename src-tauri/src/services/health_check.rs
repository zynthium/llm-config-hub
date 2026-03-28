use std::time::Instant;

use chrono::Utc;
use reqwest::StatusCode;

use crate::types::{HealthCheckResult, ModelConfig, ModelHealthResult};

pub async fn check_config(config: &ModelConfig) -> HealthCheckResult {
    let start = Instant::now();
    let base = config.base_url.trim_end_matches('/');
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap_or_default();

    let provider = config.provider.as_str();

    let response = if provider == "Anthropic" {
        let url = format!("{base}/v1/messages");
        client
            .post(&url)
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(8))
            .body(r#"{"model":"claude-3-haiku-20240307","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
            .send()
            .await
    } else if provider == "Google" {
        let url = format!("{base}/models/gemini-1.5-flash:generateContent?key={}", config.api_key);
        client
            .post(&url)
            .header("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(8))
            .body(r#"{"contents":[{"parts":[{"text":"hi"}]}]}"#)
            .send()
            .await
    } else if provider == "Ollama" {
        let root = base.trim_end_matches("/v1").trim_end_matches('/');
        let url = format!("{root}/api/tags");
        client
            .get(&url)
            .timeout(std::time::Duration::from_secs(8))
            .send()
            .await
    } else {
        // OpenAI-compatible: OpenAI, DeepSeek, Custom
        let url = format!("{base}/models");
        client
            .get(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .timeout(std::time::Duration::from_secs(8))
            .send()
            .await
    };

    match response {
        Ok(resp) => {
            let status = if resp.status().is_success() {
                "ok"
            } else {
                "fail"
            };
            let error_type = if status == "ok" { None } else { map_status_to_error(resp.status()) };
            HealthCheckResult {
                config_id: config.id.clone(),
                status: status.to_string(),
                latency_ms: start.elapsed().as_millis(),
                error_type,
                checked_at: Utc::now(),
            }
        }
        Err(err) => HealthCheckResult {
            config_id: config.id.clone(),
            status: "fail".to_string(),
            latency_ms: start.elapsed().as_millis(),
            error_type: Some(if err.is_timeout() {
                "network-timeout".to_string()
            } else {
                "network-error".to_string()
            }),
            checked_at: Utc::now(),
        },
    }
}

fn map_status_to_error(status: StatusCode) -> Option<String> {
    if status.is_success() {
        return None;
    }
    Some(match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => "auth-failed",
        StatusCode::PAYMENT_REQUIRED | StatusCode::TOO_MANY_REQUESTS => "quota-or-rate-limit",
        StatusCode::NOT_FOUND => "bad-endpoint",
        _ => "unknown-http-error",
    }
    .to_string())
}

/// Discover model IDs from Ollama's /api/tags endpoint.
/// Strips any trailing /v1 from base since /api/tags is on the root path.
async fn discover_models_ollama(client: &reqwest::Client, base: &str) -> Vec<String> {
    let root = base.trim_end_matches("/v1").trim_end_matches('/');
    let url = format!("{root}/api/tags");
    eprintln!("[ollama] discover url: {url}");
    let resp_result = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;
    let Ok(resp) = resp_result else {
        eprintln!("[ollama] request error: {:?}", resp_result.unwrap_err());
        return Vec::new();
    };
    eprintln!("[ollama] status: {}", resp.status());
    if !resp.status().is_success() {
        return Vec::new();
    }
    let body = resp.text().await.unwrap_or_default();
    eprintln!("[ollama] body (first 200): {}", &body[..body.len().min(200)]);
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) else {
        return Vec::new();
    };
    json.get("models")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

/// Discover model IDs from Anthropic's GET /v1/models endpoint.
async fn discover_models_anthropic(client: &reqwest::Client, base: &str, api_key: &str) -> Vec<String> {
    let url = format!("{base}/v1/models");
    let Ok(resp) = client
        .get(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    else {
        return Vec::new();
    };
    if !resp.status().is_success() {
        return Vec::new();
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return Vec::new();
    };
    json.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

/// Discover model IDs from Google's GET /v1beta/models endpoint.
/// Response: { "models": [ { "name": "models/gemini-1.5-pro", ... } ] }
async fn discover_models_google(client: &reqwest::Client, base: &str, api_key: &str) -> Vec<String> {
    let url = format!("{base}/models?key={api_key}");
    let Ok(resp) = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    else {
        return Vec::new();
    };
    if !resp.status().is_success() {
        return Vec::new();
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return Vec::new();
    };
    json.get("models")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    v.get("name")
                        .and_then(|n| n.as_str())
                        .map(|s| s.trim_start_matches("models/").to_string())
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Discover model IDs from /v1/models (OpenAI-compatible providers).
async fn discover_models(client: &reqwest::Client, base: &str, api_key: &str) -> Vec<String> {
    let url = format!("{base}/v1/models");
    let Ok(resp) = client
        .get(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    else {
        return Vec::new();
    };
    if !resp.status().is_success() {
        return Vec::new();
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return Vec::new();
    };
    json.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

/// Probe a single OpenAI-compatible model: try /chat/completions, fall back to /responses.
/// Mirrors verify_model_config.py dual-probe logic.
async fn probe_model_openai(
    client: &reqwest::Client,
    base: &str,
    api_key: &str,
    model: &str,
    config_id: &str,
) -> ModelHealthResult {
    let start = Instant::now();

    let chat_url = format!("{base}/v1/chat/completions");
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}]
    })
    .to_string();

    let chat_resp = client
        .post(&chat_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .body(body)
        .send()
        .await;

    if let Ok(r) = &chat_resp {
        if r.status().is_success() {
            return ModelHealthResult {
                config_id: config_id.to_string(),
                model: model.to_string(),
                status: "ok".to_string(),
                latency_ms: start.elapsed().as_millis(),
                error_type: None,
                checked_at: Utc::now(),
            };
        }
    }

    // Fallback: /responses endpoint (OpenAI o-series style)
    let resp_url = format!("{base}/v1/responses");
    let resp_body = serde_json::json!({
        "model": model,
        "max_output_tokens": 1,
        "input": "hi"
    })
    .to_string();

    let fallback = client
        .post(&resp_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .body(resp_body)
        .send()
        .await;

    let latency_ms = start.elapsed().as_millis();
    match fallback {
        Ok(r) if r.status().is_success() => {
            ModelHealthResult {
                config_id: config_id.to_string(),
                model: model.to_string(),
                status: "ok".to_string(),
                latency_ms,
                error_type: None,
                checked_at: Utc::now(),
            }
        }
        Ok(r) => ModelHealthResult {
            config_id: config_id.to_string(),
            model: model.to_string(),
            status: "fail".to_string(),
            latency_ms,
            error_type: map_status_to_error(r.status()),
            checked_at: Utc::now(),
        },
        Err(err) => ModelHealthResult {
            config_id: config_id.to_string(),
            model: model.to_string(),
            status: "fail".to_string(),
            latency_ms,
            error_type: Some(if err.is_timeout() {
                "network-timeout".to_string()
            } else {
                "network-error".to_string()
            }),
            checked_at: Utc::now(),
        },
    }
}

pub async fn check_models_for_config(config: &ModelConfig) -> Vec<ModelHealthResult> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap_or_default();
    let base = config.base_url.trim_end_matches('/');
    let provider = config.provider.as_str();

    // Explicit models from config
    let explicit_models: Vec<String> = config
        .models
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // For OpenAI-compatible providers, discover from /v1/models; for Ollama, discover from /api/tags
    let discovered: Vec<String> = if matches!(provider, "OpenAI" | "DeepSeek" | "Custom") {
        discover_models(&client, base, &config.api_key).await
    } else if provider == "Ollama" {
        discover_models_ollama(&client, base).await
    } else if provider == "Anthropic" {
        discover_models_anthropic(&client, base, &config.api_key).await
    } else if provider == "Google" {
        discover_models_google(&client, base, &config.api_key).await
    } else {
        Vec::new()
    };

    // Union: explicit first, then discovered not already listed
    let mut models: Vec<String> = explicit_models;
    for m in &discovered {
        if !models.contains(m) {
            models.push(m.clone());
        }
    }

    if models.is_empty() {
        return Vec::new();
    }

    // For Ollama: skip per-model inference probing entirely — just return discovered models as ok
    if provider == "Ollama" {
        return models
            .into_iter()
            .map(|model| ModelHealthResult {
                config_id: config.id.clone(),
                model,
                status: "ok".to_string(),
                latency_ms: 0,
                error_type: None,
                checked_at: Utc::now(),
            })
            .collect();
    }

    let mut results = Vec::with_capacity(models.len());

    for model in models {
        let result = match provider {
            "Anthropic" => {
                let start = Instant::now();
                let url = format!("{base}/v1/messages");
                let body = serde_json::json!({
                    "model": model,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}]
                })
                .to_string();
                let resp = client
                    .post(&url)
                    .header("x-api-key", &config.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .timeout(std::time::Duration::from_secs(10))
                    .body(body)
                    .send()
                    .await;
                let latency_ms = start.elapsed().as_millis();
                match resp {
                    Ok(r) if r.status().is_success() => {
                        ModelHealthResult { config_id: config.id.clone(), model, status: "ok".to_string(), latency_ms, error_type: None, checked_at: Utc::now() }
                    }
                    Ok(r) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: map_status_to_error(r.status()), checked_at: Utc::now() },
                    Err(e) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: Some(if e.is_timeout() { "network-timeout".to_string() } else { "network-error".to_string() }), checked_at: Utc::now() },
                }
            }
            "Google" => {
                let start = Instant::now();
                let url = format!("{base}/models/{model}:generateContent?key={}", config.api_key);
                let resp = client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .timeout(std::time::Duration::from_secs(10))
                    .body(r#"{"contents":[{"parts":[{"text":"hi"}]}]}"#)
                    .send()
                    .await;
                let latency_ms = start.elapsed().as_millis();
                match resp {
                    Ok(r) if r.status().is_success() => {
                        ModelHealthResult { config_id: config.id.clone(), model, status: "ok".to_string(), latency_ms, error_type: None, checked_at: Utc::now() }
                    }
                    Ok(r) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: map_status_to_error(r.status()), checked_at: Utc::now() },
                    Err(e) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: Some(if e.is_timeout() { "network-timeout".to_string() } else { "network-error".to_string() }), checked_at: Utc::now() },
                }
            }
            "Ollama" => {
                let start = Instant::now();
                let url = format!("{base}/api/chat");
                let body = serde_json::json!({
                    "model": model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "stream": false
                })
                .to_string();
                let resp = client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .timeout(std::time::Duration::from_secs(10))
                    .body(body)
                    .send()
                    .await;
                let latency_ms = start.elapsed().as_millis();
                match resp {
                    Ok(r) if r.status().is_success() => {
                        ModelHealthResult { config_id: config.id.clone(), model, status: "ok".to_string(), latency_ms, error_type: None, checked_at: Utc::now() }
                    }
                    Ok(r) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: map_status_to_error(r.status()), checked_at: Utc::now() },
                    Err(e) => ModelHealthResult { config_id: config.id.clone(), model, status: "fail".to_string(), latency_ms, error_type: Some(if e.is_timeout() { "network-timeout".to_string() } else { "network-error".to_string() }), checked_at: Utc::now() },
                }
            }
            _ => {
                // OpenAI-compatible: dual-probe (chat/completions → responses)
                probe_model_openai(&client, base, &config.api_key, &model, &config.id).await
            }
        };
        results.push(result);
    }

    results
}
