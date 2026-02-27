use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use crate::agent::types::{ModelConfig, TokenUsage, GeminiFunctionCall};
use regex::Regex;
use once_cell::sync::Lazy;

#[derive(Debug, Serialize)]
struct GroqMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

#[derive(Debug, Serialize)]
struct GroqTool {
    #[serde(rename = "type")]
    tool_type: String,
    function: GroqFunctionDefinition,
}

#[derive(Debug, Serialize)]
struct GroqFunctionDefinition {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<GroqMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<GroqTool>>,
}

#[derive(Debug, Deserialize)]
struct GroqChoice {
    message: GroqResponseMessage,
}

#[derive(Debug, Deserialize)]
struct GroqResponseMessage {
    content: Option<String>,
    #[serde(rename = "tool_calls")]
    tool_calls: Option<Vec<GroqToolCall>>,
}

#[derive(Debug, Deserialize)]
struct GroqToolCall {
    function: GroqFunctionCall,
}

#[derive(Debug, Deserialize)]
struct GroqFunctionCall {
    name: String,
    arguments: String,
}

#[derive(Debug, Deserialize)]
struct GroqUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct GroqResponse {
    choices: Vec<GroqChoice>,
    usage: Option<GroqUsage>,
}

pub struct GroqProvider {
    client: Client,
    config: ModelConfig,
    api_key: String,
}

static FUNCTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    // Matches <function=name>{"json"...}</function>, <function=name{"json"...}</function>, and other variations
    Regex::new(r"(?s)<function=([a-zA-Z0-9_-]+)[^\{]*(\{.*?\})[^<]*(?:</function>)?").unwrap()
});

impl GroqProvider {
    /// Creates a GroqProvider with a shared `reqwest::Client`.
    pub fn new(client: Client, api_key: String, config: ModelConfig) -> Self {
        Self { client, config, api_key }
    }


    pub async fn generate(
        &self,
        system_prompt: &str,
        user_message: &str,
        tools: Option<Vec<crate::agent::gemini::GeminiTool>>,
    ) -> anyhow::Result<(String, Vec<GeminiFunctionCall>, Option<TokenUsage>)> {
        self.generate_internal(system_prompt, user_message, tools, None).await
    }

    async fn generate_internal(
        &self,
        system_prompt: &str,
        user_message: &str,
        tools: Option<Vec<crate::agent::gemini::GeminiTool>>,
        retry_msg: Option<String>,
    ) -> anyhow::Result<(String, Vec<GeminiFunctionCall>, Option<TokenUsage>)> {
        let url = self.config.base_url.as_deref().unwrap_or("https://api.groq.com/openai/v1/chat/completions");

        // Map Gemini tools to Groq/OpenAI tools
        let groq_tools = tools.as_ref().map(|ts| {
            ts.iter().flat_map(|t| {
                t.function_declarations.iter().map(|f| {
                    GroqTool {
                        tool_type: "function".to_string(),
                        function: GroqFunctionDefinition {
                            name: f.name.clone(),
                            description: f.description.clone(),
                            parameters: f.parameters.clone(),
                        },
                    }
                })
            }).collect::<Vec<GroqTool>>()
        });

        let mut messages = vec![
            GroqMessage {
                role: "system".to_string(),
                content: Some(system_prompt.to_string()),
            },
            GroqMessage {
                role: "user".to_string(),
                content: Some(user_message.to_string()),
            },
        ];

        // If this is a retry, append the failed generation and correction instruction
        if let Some(ref r) = retry_msg {
            messages.push(GroqMessage {
                role: "assistant".to_string(),
                content: Some(r.clone()),
            });
            messages.push(GroqMessage {
                role: "user".to_string(),
                content: Some("CRITICAL ERROR: Your previous tool call was malformed. Please fix the JSON syntax and try again. Ensure all arguments are inside the brackets and there are no stray characters.".to_string()),
            });
        }

        let request_body = GroqRequest {
            model: self.config.model_id.clone(),
            messages,
            temperature: self.config.temperature,
            user: self.config.external_id.clone(),
            tools: if groq_tools.as_ref().map_or(true, |t| t.is_empty()) { None } else { groq_tools },
        };

        let res = self.client
            .post(url)
            .header(header::AUTHORIZATION, format!("Bearer {}", self.api_key))
            .json(&request_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let error_text = res.text().await?;
            
            // Handle Groq Tool Call hallucination errors (400 Bad Request)
            if status == 400 && error_text.contains("tool_use_failed") {
                if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
                    if let Some(failed_gen) = err_json["error"]["failed_generation"].as_str() {
                        tracing::info!("🛠️ [Groq] Native tool failure detected. Generation: {}", failed_gen);
                        // 1. Attempt manual regex parsing of the failed generation
                        if let Some(caps) = FUNCTION_REGEX.captures(failed_gen) {
                            let name = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
                            let args_str = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                            
                            let mut json_str = args_str.trim().to_string();
                            if !json_str.starts_with('{') {
                                json_str.insert(0, '{');
                            }
                            if !json_str.ends_with('}') {
                                json_str.push('}');
                            }
                            
                            let args: serde_json::Value = serde_json::from_str(&json_str)
                                .unwrap_or_else(|_| {
                                    tracing::warn!("🛠️ [Recovery] Failed to parse natively intercepted JSON: {}", json_str);
                                    serde_json::json!({})
                                });
                                
                            tracing::info!("🛠️ [Groq] Successfully intercepted and recovered tool call '{}' natively.", name);
                            return Ok((
                                failed_gen.to_string(),
                                vec![GeminiFunctionCall { name, args }],
                                None
                            ));
                        }
                        
                        // 2. If recovery fails, fallback to LLM self-correction
                        if retry_msg.is_none() {
                            tracing::warn!("🛠️ [Groq] Tool call failed natively. Attempting self-correction retry...");
                            let result = Box::pin(self.generate_internal(system_prompt, user_message, tools, Some(failed_gen.to_string()))).await;
                            return result;
                        }
                    }
                }
            }
            
            return Err(anyhow::anyhow!("Groq API Error: {}", error_text));
        }

        let parsed: GroqResponse = res.json().await?;

        let choice = parsed.choices.first()
            .ok_or_else(|| anyhow::anyhow!("No completion return from Groq"))?;
        
        let output_text = choice.message.content.clone().unwrap_or_default();
        
        let mut function_calls = Vec::new();
        if let Some(tool_calls) = &choice.message.tool_calls {
            for tc in tool_calls {
                let args: serde_json::Value = serde_json::from_str(&tc.function.arguments)
                    .unwrap_or(serde_json::json!({}));
                function_calls.push(GeminiFunctionCall {
                    name: tc.function.name.clone(),
                    args,
                });
            }
        } else {
            // RECOVERY: Check for manual function tags (Llama 3 style)
            if let Some(caps) = FUNCTION_REGEX.captures(&output_text) {
                let name = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
                let args_str = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                
                let mut json_str = args_str.trim().to_string();
                if !json_str.starts_with('{') {
                    json_str.insert(0, '{');
                }
                if !json_str.ends_with('}') {
                    json_str.push('}');
                }
                
                let args: serde_json::Value = serde_json::from_str(&json_str)
                    .unwrap_or_else(|_| {
                        tracing::warn!("🛠️ [Recovery] Failed to parse recovered JSON from Groq format: {}", json_str);
                        serde_json::json!({})
                    });
                
                tracing::info!("🛠️ [Recovery] Extracted function call from tags: {}", name);
                function_calls.push(GeminiFunctionCall { name, args });
            }
        }

        let token_usage = parsed.usage.map(|u| TokenUsage {
            input_tokens: u.prompt_tokens,
            output_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok((output_text, function_calls, token_usage))
    }

    pub async fn transcribe(&self, audio_data: Vec<u8>, filename: &str) -> anyhow::Result<String> {
        use reqwest::multipart;
        let url = "https://api.groq.com/openai/v1/audio/transcriptions";

        let part = multipart::Part::bytes(audio_data)
            .file_name(filename.to_string())
            .mime_str("audio/wav")?;

        let form = multipart::Form::new()
            .part("file", part)
            .text("model", self.config.model_id.clone());

        let res = self.client.post(url)
            .header(header::AUTHORIZATION, format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await?;

        if !res.status().is_success() {
            let error_text = res.text().await?;
            return Err(anyhow::anyhow!("Groq Whisper Error: {}", error_text));
        }

        #[derive(Deserialize)]
        struct TranscriptionResponse {
            text: String,
        }

        let parsed: TranscriptionResponse = res.json().await?;
        Ok(parsed.text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_groq_regex() {
        let error_text = r#"{"error":{"message":"Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"\u003cfunction=brave_search\u003e\"query\": \"today's date\"}\u003c/function\u003e"}}"#;
        let err_json: serde_json::Value = serde_json::from_str(error_text).unwrap();
        let failed_gen = err_json["error"]["failed_generation"].as_str().unwrap();
        println!("Failed gen:\n{}", failed_gen);
        
        if let Some(caps) = FUNCTION_REGEX.captures(failed_gen) {
            println!("Matched!");
            println!("Name: {}", caps.get(1).unwrap().as_str());
            let args_str = caps.get(2).unwrap().as_str();
            println!("Args: {}", args_str);
            
            let mut json_str = args_str.trim().to_string();
            if !json_str.starts_with('{') {
                json_str.insert(0, '{');
            }
            if !json_str.ends_with('}') {
                json_str.push('}');
            }
            
            let args: serde_json::Value = serde_json::from_str(&json_str).unwrap_or(json!({}));
                
            println!("Parsed Args: {}", args);
        } else {
            println!("Did not match!");
        }
    }

    #[test]
    fn test_groq_regex_missing_bracket_with_curlies() {
        let error_text = r#"{"error":{"message":"Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"\u003cfunction=share_finding{\"topic\": \"Current Date\", \"finding\": \"Today's date is February 26, 2026\"}\u003c/function\u003e"}}"#;
        let err_json: serde_json::Value = serde_json::from_str(error_text).unwrap();
        let failed_gen = err_json["error"]["failed_generation"].as_str().unwrap();
        println!("Failed gen:\n{}", failed_gen);
        
        if let Some(caps) = FUNCTION_REGEX.captures(failed_gen) {
            println!("Matched!");
            println!("Name: {}", caps.get(1).unwrap().as_str());
            let args_str = caps.get(2).unwrap().as_str();
            println!("Args: {}", args_str);
            
            let mut json_str = args_str.trim().to_string();
            if !json_str.starts_with('{') {
                json_str.insert(0, '{');
            }
            if !json_str.ends_with('}') {
                json_str.push('}');
            }
            
            let args: serde_json::Value = serde_json::from_str(&json_str).unwrap_or(json!({}));
                
            println!("Parsed Args: {}", args);
        } else {
            println!("Did not match!");
            panic!("Regex did not match the missing-bracket form!");
        }
    }
}
