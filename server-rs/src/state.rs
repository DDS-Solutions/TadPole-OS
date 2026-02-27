use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, oneshot};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use dashmap::DashMap;
use sqlx::SqlitePool;
use reqwest::Client;

use crate::agent::types::{OversightEntry, EngineAgent};

/// Exact parity with the `LogEntry` frontend interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    #[serde(rename = "type")]
    pub event_type: String,
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub source: String,
    pub severity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub text: String,
}

impl LogEntry {
    pub fn new(source: &str, text: &str, severity: &str) -> Self {
        Self {
            event_type: "log".to_string(),
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            source: source.to_string(),
            text: text.to_string(),
            severity: severity.to_string(),
            agent_id: None,
        }
    }
}

/// The global application state shared across all routes via Axum State.
pub struct AppState {
    /// Broadcast system logs to all connected UI WebSockets
    pub tx: broadcast::Sender<LogEntry>,
    
    /// Pending Oversight entries awaiting decision
    pub oversight_queue: DashMap<String, OversightEntry>,
    
    /// Resolvers for pending oversight promises.
    pub oversight_resolvers: DashMap<String, oneshot::Sender<bool>>,
    
    /// Decided oversight entries (bounded in-memory ledger for the dashboard)
    pub oversight_ledger: Mutex<Vec<serde_json::Value>>,

    /// Generic broadcast for Engine events (oversight:new, etc)
    pub event_tx: broadcast::Sender<serde_json::Value>,

    /// Global governance setting: whether to auto-approve low-risk skills.
    pub auto_approve_safe_skills: AtomicBool,

    /// The live agent registry, synced with persistence file
    pub agents: DashMap<String, EngineAgent>,
    pub providers: DashMap<String, crate::agent::types::ProviderConfig>,
    pub models: DashMap<String, crate::agent::types::ModelEntry>,

    /// Token for authenticating deploy requests (from NEURAL_TOKEN env var)
    pub deploy_token: String,

    /// Database pool for persistence
    pub pool: SqlitePool,

    /// Shared HTTP client — connection pool is reused across all LLM calls.
    /// Industry standard: one client per process, not per request.
    pub http_client: Arc<Client>,

    /// Registry for dynamic file-based Skills and Workflows
    pub capabilities: Arc<crate::agent::capabilities::CapabilitiesRegistry>,

    /// Manager for Lifecycle Hooks (Pre/Post tool execution)
    pub hooks: Arc<crate::agent::hooks::HooksManager>,
}

impl AppState {
    pub async fn new() -> Self {
        let (tx, _) = broadcast::channel(1000);
        let (event_tx, _) = broadcast::channel(1000);
        
        // 🔐 SEC-01 FIX: Panic on missing token. A fallback default means the API
        // is protected by a known, public secret — a critical security hole.
        let deploy_token = std::env::var("NEURAL_TOKEN").unwrap_or_else(|_| {
            if cfg!(debug_assertions) {
                // Dev builds only: allow a dev token with a loud warning
                tracing::warn!("⚠️  NEURAL_TOKEN not set. Using insecure dev token. DO NOT deploy without setting this variable.");
                "tadpole-dev-token-2026".to_string()
            } else {
                panic!("🚨 FATAL: NEURAL_TOKEN environment variable is not set. The engine cannot start without a secure authentication token. Set NEURAL_TOKEN in your .env file.");
            }
        });
        
        // Initialize Database
        let mut database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite:tadpole.db".to_string());
        
        // Ensure the path is absolute for Windows environments to avoid Code 14 errors
        if database_url.starts_with("sqlite:") && !database_url.contains(":/") && !database_url.contains(":\\") && !database_url.contains("/") && !database_url.contains("\\") {
            if let Ok(cwd) = std::env::current_dir() {
                let db_path = cwd.join("tadpole.db");
                database_url = format!("sqlite:{}", db_path.to_string_lossy());
                tracing::info!("🛠️ Auto-resolving relative database path to: {}", database_url);
            }
        }

        let pool = crate::db::init_db(&database_url).await
            .expect("Failed to initialize database");

        // Initialize registries
        let providers_list = crate::agent::persistence::load_providers();
        let providers = DashMap::new();
        for p in providers_list {
            providers.insert(p.id.clone(), p);
        }

        let models_list = crate::agent::persistence::load_models();
        let models = DashMap::new();
        for m in models_list {
            models.insert(m.id.clone(), m);
        }

        // Load agents from DB, fall back to JSON/Mock and migrate
        let agents_list = match crate::agent::persistence::load_agents_db(&pool).await {
            Ok(agents) if !agents.is_empty() => agents,
            _ => {
                tracing::info!("🗄️ Database empty or failed to load. Migrating from JSON registry...");
                let legacy_agents = crate::agent::persistence::load_registry();
                for agent in &legacy_agents {
                    let _ = crate::agent::persistence::save_agent_db(&pool, agent).await;
                }
                legacy_agents
            }
        };

        let agents = DashMap::new();
        for agent in agents_list {
            agents.insert(agent.id.clone(), agent);
        }

        // PERF-01 FIX: Build ONE shared http client for all providers.
        // reqwest::Client manages an internal connection pool — reusing it
        // gives us HTTP keep-alive and avoids TLS handshake overhead per call.
        let http_client = Arc::new(
            Client::builder()
                .timeout(std::time::Duration::from_secs(90))
                .pool_max_idle_per_host(20)
                .build()
                .expect("Failed to build HTTP client")
        );

        let capabilities = crate::agent::capabilities::CapabilitiesRegistry::new().await
            .expect("Failed to initialize dynamic capabilities registry (check data/ directory permissions)");

        Self { 
            tx,
            oversight_queue: DashMap::new(),
            oversight_resolvers: DashMap::new(),
            oversight_ledger: Mutex::new(Vec::new()),
            auto_approve_safe_skills: AtomicBool::new(true),
            event_tx,
            agents,
            providers,
            models,
            deploy_token,
            pool,
            http_client,
            capabilities: Arc::new(capabilities),
            hooks: Arc::new(crate::agent::hooks::HooksManager::new(std::path::Path::new("data"))), // Default data dir, adjusted in new() logic if needed
        }
    }

    /// Helper to broadcast a system log
    pub fn broadcast_sys(&self, text: &str, severity: &str) {
        let entry = LogEntry::new("System", text, severity);
        let _ = self.tx.send(entry);
    }

    /// Helper to broadcast an arbitrary Engine event
    pub fn emit_event(&self, event: serde_json::Value) {
        let _ = self.event_tx.send(event);
    }

    /// Persists the current state of all agents to the database.
    /// PERF-02 FIX: Runs all save futures concurrently via `join_all` 
    /// instead of a sequential `for` loop, reducing total save time from O(N) to O(1).
    pub async fn save_agents(&self) {
        let agents_vec: Vec<EngineAgent> = self.agents.iter().map(|kv| kv.value().clone()).collect();
        
        // Primary persistence: SQLite — concurrent writes
        let save_futs = agents_vec.iter().map(|agent| {
            let pool = self.pool.clone();
            let agent = agent.clone();
            async move {
                if let Err(e) = crate::agent::persistence::save_agent_db(&pool, &agent).await {
                    tracing::error!("❌ Failed to save agent {} to DB: {}", agent.id, e);
                }
            }
        });
        futures::future::join_all(save_futs).await;

        // Legacy JSON backup — opt-in only
        if std::env::var("LEGACY_JSON_BACKUP").unwrap_or_default() == "true" {
            if let Err(e) = crate::agent::persistence::save_registry(agents_vec).await {
                tracing::error!("❌ Failed to save agent state to JSON: {}", e);
            }
        }
    }

    pub async fn save_providers(&self) {
        let providers_vec: Vec<crate::agent::types::ProviderConfig> = self.providers.iter().map(|kv| kv.value().clone()).collect();
        if let Err(e) = crate::agent::persistence::save_providers(providers_vec).await {
            tracing::error!("❌ Failed to save provider state: {}", e);
        }
    }

    pub async fn save_models(&self) {
        let models_vec: Vec<crate::agent::types::ModelEntry> = self.models.iter().map(|kv| kv.value().clone()).collect();
        if let Err(e) = crate::agent::persistence::save_models(models_vec).await {
            tracing::error!("❌ Failed to save model state: {}", e);
        }
    }
}
