use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    #[serde(rename = "inputTokens")]
    pub input_tokens: u32,
    #[serde(rename = "outputTokens")]
    pub output_tokens: u32,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u32,
}

/// Configuration for an agent's model.
/// Kept in sync with TS `ModelConfig` in `server/types.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    #[serde(rename = "maxTokens")]
    pub max_tokens: Option<u32>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
    pub rpm: Option<u32>,
    pub rpd: Option<u32>,
    pub tpm: Option<u32>,
    pub tpd: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    pub protocol: String, // "openai", "anthropic", "google", etc.
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
    #[serde(rename = "customHeaders")]
    pub custom_headers: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "audioModel")]
    pub audio_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub rpm: Option<u32>,
    pub tpm: Option<u32>,
    pub rpd: Option<u32>,
    pub tpd: Option<u32>,
    pub modality: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineAgent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub department: String,
    pub description: String,
    
    /// Primary model ID lookup. If missing, falls back to legacy `model` field.
    #[serde(rename = "model")]
    pub model_id: Option<String>,

    /// Legacy inline model config (kept for backward compatibility during migration)
    #[serde(rename = "modelConfig")]
    pub model: ModelConfig,
    
    // UI Extension: Multiple model slots (referenced by model IDs)
    #[serde(rename = "model2")]
    pub model_2: Option<String>,
    #[serde(rename = "model3")]
    pub model_3: Option<String>,

    #[serde(rename = "modelConfig2")]
    pub model_config2: Option<ModelConfig>,
    #[serde(rename = "modelConfig3")]
    pub model_config3: Option<ModelConfig>,

    #[serde(rename = "activeModelSlot")]
    pub active_model_slot: Option<i32>,
    
    // UI Extension: Active mission data
    #[serde(rename = "activeMission")]
    pub active_mission: Option<serde_json::Value>,
    
    pub status: String,
    #[serde(rename = "tokensUsed")]
    pub tokens_used: u32,
    #[serde(rename = "tokenUsage")]
    pub token_usage: TokenUsage,
    
    pub skills: Vec<String>,
    pub workflows: Vec<String>,

    /// Flexible metadata for frontend compatibility (role, department, etc.)
    pub metadata: std::collections::HashMap<String, serde_json::Value>,

    /// UI Extension: Custom theme color (HEX)
    #[serde(rename = "themeColor")]
    pub theme_color: Option<String>,

    #[serde(rename = "budgetUsd")]
    pub budget_usd: f64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPayload {
    pub message: String,
    #[serde(rename = "clusterId")]
    pub cluster_id: Option<String>,
    pub department: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    pub rpm: Option<u32>,
    pub tpm: Option<u32>,
    #[serde(rename = "budgetUsd")]
    pub budget_usd: Option<f64>,
    #[serde(rename = "swarmDepth")]
    pub swarm_depth: Option<u32>,
    #[serde(rename = "swarmLineage")]
    pub swarm_lineage: Option<Vec<String>>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
    #[serde(rename = "safeMode")]
    pub safe_mode: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfigUpdate {
    pub name: Option<String>,
    pub role: Option<String>,
    pub department: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    pub model2: Option<String>,
    pub model3: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    #[serde(rename = "themeColor")]
    pub theme_color: Option<String>,
    #[serde(rename = "budgetUsd")]
    pub budget_usd: Option<f64>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
    pub skills: Option<Vec<String>>,
    pub workflows: Option<Vec<String>>,
    #[serde(rename = "activeModelSlot")]
    pub active_model_slot: Option<i32>,
    #[serde(rename = "modelConfig2")]
    pub model_config2: Option<ModelConfig>,
    #[serde(rename = "modelConfig3")]
    pub model_config3: Option<ModelConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub mission_id: Option<String>,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub skill: String,
    pub params: serde_json::Value,
    pub department: String,
    pub description: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CapabilityType {
    Skill,
    Workflow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityProposal {
    pub r#type: CapabilityType,
    pub name: String,
    pub description: String,
    pub execution_command: Option<String>,
    pub schema: Option<serde_json::Value>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OversightEntry {
    pub id: String,
    pub mission_id: Option<String>,
    #[serde(rename = "toolCall")]
    pub tool_call: Option<ToolCall>,
    #[serde(rename = "capabilityProposal")]
    pub capability_proposal: Option<CapabilityProposal>,
    pub status: String, // "pending" | "approved" | "rejected"
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MissionStatus {
    Pending,
    Active,
    Completed,
    Failed,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: String,
    pub agent_id: String,
    pub title: String,
    pub status: MissionStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub budget_usd: f64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionLog {
    pub id: String,
    pub mission_id: String,
    pub agent_id: String,
    pub source: String,
    pub text: String,
    pub severity: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiFunctionCall {
    pub name: String,
    pub args: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OversightDecision {
    pub decision: String, // "approved" | "rejected"
}
