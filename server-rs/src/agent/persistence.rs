use std::fs;
use std::path::Path;
use anyhow::{Context, Result};
use crate::agent::types::{EngineAgent, ProviderConfig, ModelEntry, TokenUsage};
use sqlx::SqlitePool;

const AGENTS_FILE: &str = "data/agents.json";
const PROVIDERS_FILE: &str = "data/infra_providers.json";
const MODELS_FILE: &str = "data/infra_models.json";

/// Loads the agent registry from disk.
/// Falls back to the mock registry if the file is missing or unparsable.
pub fn load_registry() -> Vec<EngineAgent> {
    if Path::new(AGENTS_FILE).exists() {
        match fs::read_to_string(AGENTS_FILE) {
            Ok(content) => {
                match serde_json::from_str::<Vec<EngineAgent>>(&content) {
                    Ok(agents) => {
                        tracing::info!("✅ Loaded {} agents from persistence layer", agents.len());
                        return agents;
                    }
                    Err(e) => tracing::error!(
                        file = AGENTS_FILE,
                        error = %e,
                        line = e.line(),
                        column = e.column(),
                        "❌ [Persistence] JSON parse failure — falling back to mock registry"
                    ),
                }
            }
            Err(e) => tracing::error!(
                file = AGENTS_FILE,
                error = %e,
                "❌ [Persistence] File read failure — falling back to mock registry"
            ),
        }
    }
    tracing::warn!("⚠️ [Persistence] Using default mock registry");
    crate::agent::registry::get_mock_registry()
}

/// Persists the full agent registry to disk as pretty-printed JSON.
/// Uses `tokio::fs` to avoid blocking the async runtime.
pub async fn save_registry(agents: Vec<EngineAgent>) -> Result<()> {
    let content = serde_json::to_string_pretty(&agents)?;
    tokio::fs::write(AGENTS_FILE, content).await.context("Failed to save agents")?;
    Ok(())
}

/// Loads agents from the database.
pub async fn load_agents_db(pool: &SqlitePool) -> Result<Vec<EngineAgent>> {
    let rows = sqlx::query("SELECT * FROM agents").fetch_all(pool).await?;
    let mut agents = Vec::new();

    for row in rows {
        use sqlx::Row;
        let metadata_str: String = row.get("metadata");
        let metadata: std::collections::HashMap<String, serde_json::Value> = 
            serde_json::from_str(&metadata_str).unwrap_or_default();
        
        let agent = EngineAgent {
            id: row.get("id"),
            name: row.get("name"),
            role: row.get("role"),
            department: row.get("department"),
            description: row.get("description"),
            model_id: row.get("model_id"),
            tokens_used: row.get::<Option<i64>, _>("tokens_used").unwrap_or(0) as u32,
            status: row.get("status"),
            theme_color: row.get("theme_color"),
            budget_usd: row.get::<Option<f64>, _>("budget_usd").unwrap_or(0.0),
            cost_usd: row.get::<Option<f64>, _>("cost_usd").unwrap_or(0.0),
            metadata,
            skills: serde_json::from_str(&row.get::<String, _>("skills")).unwrap_or_default(),
            workflows: serde_json::from_str(&row.get::<String, _>("workflows")).unwrap_or_default(),
            model_2: row.try_get("model_2").ok(),
            model_3: row.try_get("model_3").ok(),
            model_config2: row.get::<Option<String>, _>("model_config2").and_then(|s| serde_json::from_str(&s).ok()),
            model_config3: row.get::<Option<String>, _>("model_config3").and_then(|s| serde_json::from_str(&s).ok()),
            active_model_slot: row.get::<Option<i32>, _>("active_model_slot"),
            token_usage: TokenUsage::default(),
            // Fallbacks for transient UI data not in core DB table yet
            model: crate::agent::types::ModelConfig {
                provider: "".to_string(), // Resolved dynamically in runner
                model_id: row.get::<Option<String>, _>("model_id").unwrap_or_else(|| "gemini-1.5-pro".to_string()),
                api_key: None,
                base_url: None,
                system_prompt: None,
                temperature: None,
                max_tokens: None,
                external_id: None,
                rpm: None,
                rpd: None,
                tpm: None,
                tpd: None,
            },
            active_mission: None,
        };
        agents.push(agent);
    }
    Ok(agents)
}

/// Saves a single agent to the database.
pub async fn save_agent_db(pool: &SqlitePool, agent: &EngineAgent) -> Result<()> {
    let metadata_json = serde_json::to_string(&agent.metadata)?;
    
    sqlx::query("INSERT INTO agents (id, name, role, department, description, model_id, tokens_used, status, theme_color, budget_usd, cost_usd, metadata, skills, workflows, model_2, model_3, model_config2, model_config3, active_model_slot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            department = excluded.department,
            description = excluded.description,
            model_id = excluded.model_id,
            tokens_used = excluded.tokens_used,
            status = excluded.status,
            theme_color = excluded.theme_color,
            budget_usd = excluded.budget_usd,
            cost_usd = excluded.cost_usd,
            metadata = excluded.metadata,
            skills = excluded.skills,
            workflows = excluded.workflows,
            model_2 = excluded.model_2,
            model_3 = excluded.model_3,
            model_config2 = excluded.model_config2,
            model_config3 = excluded.model_config3,
            active_model_slot = excluded.active_model_slot")
    .bind(&agent.id)
    .bind(&agent.name)
    .bind(&agent.role)
    .bind(&agent.department)
    .bind(&agent.description)
    .bind(&agent.model_id)
    .bind(agent.tokens_used as i64)
    .bind(&agent.status)
    .bind(&agent.theme_color)
    .bind(agent.budget_usd)
    .bind(agent.cost_usd)
    .bind(metadata_json)
    .bind(serde_json::to_string(&agent.skills).unwrap_or_else(|_| "[]".to_string()))
    .bind(serde_json::to_string(&agent.workflows).unwrap_or_else(|_| "[]".to_string()))
    .bind(&agent.model_2)
    .bind(&agent.model_3)
    .bind(agent.model_config2.as_ref().and_then(|c| serde_json::to_string(c).ok()))
    .bind(agent.model_config3.as_ref().and_then(|c| serde_json::to_string(c).ok()))
    .bind(agent.active_model_slot)
    .execute(pool)
    .await?;

    Ok(())
}

/// Loads provider configurations from disk.
/// Returns default providers if the file is missing or corrupt.
pub fn load_providers() -> Vec<ProviderConfig> {
    if Path::new(PROVIDERS_FILE).exists() {
        match fs::read_to_string(PROVIDERS_FILE) {
            Ok(content) => match serde_json::from_str::<Vec<ProviderConfig>>(&content) {
                Ok(providers) => return providers,
                Err(e) => tracing::error!(
                    file = PROVIDERS_FILE,
                    error = %e,
                    "❌ [Persistence] Provider JSON parse failure — falling back to defaults"
                ),
            },
            Err(e) => tracing::error!(
                file = PROVIDERS_FILE,
                error = %e,
                "❌ [Persistence] Provider file read failure — falling back to defaults"
            ),
        }
    }
    crate::agent::registry::get_default_providers()
}

/// Persists all provider configurations to disk.
/// Uses `tokio::fs` to avoid blocking the async runtime.
pub async fn save_providers(providers: Vec<ProviderConfig>) -> Result<()> {
    let content = serde_json::to_string_pretty(&providers)?;
    tokio::fs::write(PROVIDERS_FILE, content).await.context("Failed to save providers")?;
    Ok(())
}

/// Loads the model registry from disk.
/// Returns default models if the file is missing or corrupt.
pub fn load_models() -> Vec<ModelEntry> {
    if Path::new(MODELS_FILE).exists() {
        match fs::read_to_string(MODELS_FILE) {
            Ok(content) => match serde_json::from_str::<Vec<ModelEntry>>(&content) {
                Ok(models) => return models,
                Err(e) => tracing::error!(
                    file = MODELS_FILE,
                    error = %e,
                    "❌ [Persistence] Model JSON parse failure — falling back to defaults"
                ),
            },
            Err(e) => tracing::error!(
                file = MODELS_FILE,
                error = %e,
                "❌ [Persistence] Model file read failure — falling back to defaults"
            ),
        }
    }
    crate::agent::registry::get_default_models()
}

/// Persists all model entries to disk.
/// Uses `tokio::fs` to avoid blocking the async runtime.
pub async fn save_models(models: Vec<ModelEntry>) -> Result<()> {
    let content = serde_json::to_string_pretty(&models)?;
    tokio::fs::write(MODELS_FILE, content).await.context("Failed to save models")?;
    Ok(())
}
