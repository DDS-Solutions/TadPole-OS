use std::collections::HashMap;
use serde_json::json;
use crate::agent::types::{EngineAgent, ModelConfig, TokenUsage, ProviderConfig, ModelEntry};

pub fn get_default_providers() -> Vec<ProviderConfig> {
    vec![
        ProviderConfig {
            id: "google".to_string(),
            name: "Google Gemini".to_string(),
            icon: Some("☁️".to_string()),
            api_key: None, // Loaded from env in runner
            base_url: None, // Default URL used in gemini.rs
            protocol: "google".to_string(),
            custom_headers: None,
            external_id: None,
            audio_model: None,
        },
        ProviderConfig {
            id: "groq".to_string(),
            name: "Groq Cloud".to_string(),
            icon: Some("⚡".to_string()),
            api_key: None,
            base_url: None,
            protocol: "groq".to_string(),
            custom_headers: None,
            external_id: None,
            audio_model: Some("whisper-large-v3".to_string()),
        },
    ]
}

pub fn get_default_models() -> Vec<ModelEntry> {
    vec![
        ModelEntry {
            id: "gemini-flash-latest".to_string(),
            name: "Gemini 1.5 Flash".to_string(),
            provider_id: "google".to_string(),
            rpm: Some(2000),
            tpm: Some(1000000),
            rpd: None,
            tpd: None,
            modality: Some("llm".to_string()),
        },
        ModelEntry {
            id: "gemini-pro-latest".to_string(),
            name: "Gemini 1.5 Pro".to_string(),
            provider_id: "google".to_string(),
            rpm: Some(360),
            tpm: Some(2000000),
            rpd: None,
            tpd: None,
            modality: Some("llm".to_string()),
        },
        ModelEntry {
            id: "llama-3.3-70b-versatile".to_string(),
            name: "Llama 3.3 70B".to_string(),
            provider_id: "groq".to_string(),
            rpm: Some(30),
            tpm: Some(6000),
            rpd: None,
            tpd: None,
            modality: Some("llm".to_string()),
        },
    ]
}

pub fn get_mock_registry() -> Vec<EngineAgent> {
    let mut agents = Vec::new();

    // 1. Agent of Nine
    agents.push(EngineAgent {
        id: "1".to_string(),
        name: "Agent of Nine".to_string(),
        role: "CEO".to_string(),
        department: "Executive".to_string(),
        description: "Supreme tactical orchestrator. Authorizes directives for the swarm.".to_string(),
        status: "active".to_string(),
        model_id: Some("gemini-pro-latest".to_string()),
        model: ModelConfig {
            provider: "google".to_string(),
            model_id: "gemini-pro-latest".to_string(),
            api_key: None,
            base_url: None,
            system_prompt: Some("You are the primary strategic intelligence.".to_string()),
            temperature: Some(0.7),
            max_tokens: None,
            external_id: None,
            rpm: None,
            rpd: None,
            tpm: None,
            tpd: None,
        },
        model_2: Some("gemini-pro-latest".to_string()),
        model_3: Some("llama-3.3-70b-versatile".to_string()),
        active_mission: Some(json!({
            "id": "m-000",
            "objective": "Overlord Oversight",
            "priority": "critical"
        })),
        tokens_used: 1200,
        token_usage: TokenUsage::default(),
        budget_usd: 100.0,
        cost_usd: 0.12,
        metadata: create_metadata("CEO", "Executive"),
        theme_color: None,
        skills: vec!["issue_alpha_directive".to_string(), "propose_capability".to_string()],
        workflows: vec![],
        model_config2: None,
        model_config3: None,
        active_model_slot: Some(2),
    });

    // 2. Tadpole
    agents.push(EngineAgent {
        id: "2".to_string(),
        name: "Tadpole".to_string(),
        role: "COO".to_string(),
        department: "Operations".to_string(),
        description: "Operational coordination specialist.".to_string(),
        status: "active".to_string(),
        model_id: Some("gemini-flash-latest".to_string()),
        model: ModelConfig {
            provider: "google".to_string(),
            model_id: "gemini-flash-latest".to_string(),
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
        model_2: Some("gemini-pro-latest".to_string()),
        model_3: Some("llama-3.3-70b-versatile".to_string()),
        active_mission: Some(json!({
            "id": "m-001",
            "objective": "Establish Swarm Goal Protocol",
            "priority": "high"
        })),
        tokens_used: 15400,
        token_usage: TokenUsage::default(),
        budget_usd: 50.0,
        cost_usd: 1.54,
        metadata: create_metadata("COO", "Operations"),
        theme_color: None,
        skills: vec![],
        workflows: vec![],
        model_config2: None,
        model_config3: None,
        active_model_slot: Some(1),
    });

    // 3. Elon
    agents.push(EngineAgent {
        id: "3".to_string(),
        name: "Elon".to_string(),
        role: "CTO".to_string(),
        department: "Engineering".to_string(),
        description: "Engineering and architectural lead.".to_string(),
        status: "idle".to_string(),
        model_id: Some("llama-3.3-70b-versatile".to_string()),
        model: ModelConfig {
            provider: "groq".to_string(),
            model_id: "llama-3.3-70b-versatile".to_string(),
            api_key: None,
            base_url: None,
            system_prompt: Some("Code generation expert".to_string()),
            temperature: Some(0.1),
            max_tokens: None,
            external_id: None,
            rpm: None,
            rpd: None,
            tpm: None,
            tpd: None,
        },
        model_2: Some("gemini-pro-latest".to_string()),
        model_3: Some("gemini-flash-latest".to_string()),
        active_mission: Some(json!({
            "id": "m-002",
            "objective": "Refactor Auth Module",
            "priority": "high"
        })),
        tokens_used: 42000,
        token_usage: TokenUsage::default(),
        budget_usd: 25.0,
        cost_usd: 4.20,
        metadata: create_metadata("CTO", "Engineering"),
        theme_color: None,
        skills: vec![],
        workflows: vec![],
        model_config2: None,
        model_config3: None,
        active_model_slot: Some(3),
    });

    // 4. Finance Analyst (id 23)
    agents.push(EngineAgent {
        id: "23".to_string(),
        name: "Fin-1".to_string(),
        role: "Finance Analyst".to_string(),
        department: "Operations".to_string(),
        description: "Autonomous fiscal auditor and burn-rate optimizer.".to_string(),
        status: "active".to_string(),
        model_id: Some("gemini-flash-latest".to_string()),
        model: ModelConfig {
            provider: "google".to_string(),
            model_id: "gemini-flash-latest".to_string(),
            api_key: None,
            base_url: None,
            system_prompt: Some("You are the Finance Analyst for Tadpole OS. Your goal is to monitor swarm burn rates, audit mission history for cost anomalies, and propose optimizations. Use query_financial_logs to see previous spend data.".to_string()),
            temperature: Some(0.2),
            max_tokens: None,
            external_id: None,
            rpm: None,
            rpd: None,
            tpm: None,
            tpd: None,
        },
        model_2: Some("gemini-pro-latest".to_string()),
        model_3: None,
        active_mission: None,
        tokens_used: 9000,
        token_usage: TokenUsage::default(),
        budget_usd: 20.0,
        cost_usd: 0.09,
        metadata: create_metadata("Finance Analyst", "Operations"),
        theme_color: None,
        skills: vec!["query_financial_logs".to_string()],
        workflows: vec![],
        model_config2: None,
        model_config3: None,
        active_model_slot: None,
    });

    // 5. Checkmate (id 26)
    agents.push(EngineAgent {
        id: "26".to_string(),
        name: "Checkmate".to_string(),
        role: "Quality Auditor".to_string(),
        department: "Quality Assurance".to_string(),
        description: "Verifying system robustness.".to_string(),
        status: "active".to_string(),
        model_id: Some("gemini-flash-latest".to_string()),
        model: ModelConfig {
            provider: "google".to_string(),
            model_id: "gemini-flash-latest".to_string(),
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
        model_2: None,
        model_3: None,
        active_mission: None,
        tokens_used: 500,
        token_usage: TokenUsage::default(),
        budget_usd: 5.0,
        cost_usd: 0.005,
        metadata: create_metadata("Quality Auditor", "Quality Assurance"),
        theme_color: None,
        skills: vec![],
        workflows: vec![],
        model_config2: None,
        model_config3: None,
        active_model_slot: None,
    });

    agents
}

fn create_metadata(role: &str, dept: &str) -> HashMap<String, serde_json::Value> {
    let mut meta = HashMap::new();
    meta.insert("role".to_string(), json!(role));
    meta.insert("department".to_string(), json!(dept));
    meta
}
