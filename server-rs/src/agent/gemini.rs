use reqwest::Client;

use serde::{Deserialize, Serialize};
use crate::agent::types::{ModelConfig, TokenUsage};

#[derive(Debug, Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeminiFunctionDeclaration {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeminiTool {
    pub function_declarations: Vec<GeminiFunctionDeclaration>,
}

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<GeminiTool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GeminiFunctionCall {
    pub name: String,
    pub args: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
    #[serde(rename = "functionCall")]
    pub function_call: Option<GeminiFunctionCall>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponseCandidate {
    content: Option<GeminiResponseContent>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Debug, Deserialize)]
struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: u32,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: u32,
    #[serde(rename = "totalTokenCount")]
    total_token_count: u32,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiResponseCandidate>>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<GeminiUsageMetadata>,
}

pub struct GeminiProvider {
    client: Client,
    config: ModelConfig,
    api_key: String,
}

impl GeminiProvider {
    /// Creates a GeminiProvider.
    /// Accepts a shared `reqwest::Client` to reuse the underlying connection pool.
    pub fn new(client: Client, api_key: String, config: ModelConfig) -> Self {
        Self { client, config, api_key }
    }


    /// Generates a response from the Gemini HTTP API.
    pub async fn generate(
        &self,
        prompt: &str,
        tools: Option<Vec<GeminiTool>>,
    ) -> anyhow::Result<(String, Vec<crate::agent::types::GeminiFunctionCall>, Option<TokenUsage>)> {
        let base_url = self.config.base_url.clone().unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1".to_string());
        let url = format!(
            "{}/models/{}:generateContent",
            base_url,
            self.config.model_id
        );
        tracing::info!("🌐 [Gemini] Calling URL: {}", url);

        let request_body = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: prompt.to_string(),
                }],
            }],
            tools,
            user: self.config.external_id.clone(),
        };

        let res = self.client
            .post(&url)
            .header("x-goog-api-key", &self.api_key)
            .json(&request_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let error_text = res.text().await?;
            return Err(anyhow::anyhow!("Gemini API Error: {}", error_text));
        }

        let parsed: GeminiResponse = res.json().await?;

        let mut output_text = String::new();
        let mut function_calls = Vec::new();

        if let Some(candidates) = parsed.candidates {
            if let Some(candidate) = candidates.first() {
                if let Some(content) = &candidate.content {
                    for part in &content.parts {
                        if let Some(text) = &part.text {
                            output_text.push_str(text);
                        }
                        if let Some(fc) = &part.function_call {
                            function_calls.push(crate::agent::types::GeminiFunctionCall {
                                name: fc.name.clone(),
                                args: fc.args.clone(),
                            });
                        }
                    }
                }
            }
        }

        let token_usage = parsed.usage_metadata.map(|usage| TokenUsage {
            input_tokens: usage.prompt_token_count,
            output_tokens: usage.candidates_token_count,
            total_tokens: usage.total_token_count,
        });

        Ok((output_text, function_calls, token_usage))
    }
}
