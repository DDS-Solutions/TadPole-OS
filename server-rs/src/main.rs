use axum::{
    routing::{get, post, put},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod routes;
mod state;
mod agent;
mod adapter;
mod middleware;

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Initialize Tracing (Structured Logging)
    // Environment filter allows for granular control over log levels via RUST_LOG env var.
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server_rs=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load Environment Variables
    if dotenvy::dotenv().is_err() {
        tracing::warn!("No .env file found. Relying on system environment variables.");
    }

    // 3. Configure CORS
    // Reads from ALLOWED_ORIGINS env (comma-separated). Falls back to allow-all for local dev.
    let cors = match std::env::var("ALLOWED_ORIGINS") {
        Ok(origins) if !origins.trim().is_empty() => {
            let allowed: Vec<_> = origins
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect();
            
            if allowed.is_empty() {
                tracing::warn!("CORS: ALLOWED_ORIGINS was set but no valid origins could be parsed — defaulting to permissive");
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any)
            } else {
                tracing::info!("CORS: Restricting to {} origin(s)", allowed.len());
                CorsLayer::new()
                    .allow_origin(allowed)
                    .allow_methods(Any)
                    .allow_headers(Any)
            }
        }
        _ => {
            tracing::warn!("CORS: No valid ALLOWED_ORIGINS set — defaulting to permissive (allow all) for dev mode");
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        }
    };

    // 4. Initialize Global AppState
    // Wrapped in Arc for thread-safe sharing across all request handlers.
    let app_state = Arc::new(AppState::new().await);

    // 4.1 Launch Heartbeat Loop to drive UI presence
    let heartbeat_state = app_state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            let agent_count = heartbeat_state.agents.len();
            heartbeat_state.emit_event(serde_json::json!({
                "type": "engine:health",
                "uptime": 0, 
                "agentCount": agent_count,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }));
        }
    });

    // 5. Build Axum Router
    // Apply auth middleware to all routes except health check.
    let protected_routes = Router::new()
        .route("/agents", get(routes::agent::get_agents))
        .route("/agents", post(routes::agent::create_agent))
        .route("/agents/:id/send", post(routes::agent::send_task))
        .route("/agents/:id", put(routes::agent::update_agent))
        .route("/agents/:id/pause", post(routes::agent::pause_agent))
        .route("/agents/:id/resume", post(routes::agent::resume_agent))
        .route("/oversight/:id/decide", post(routes::oversight::decide_oversight))
        .route("/oversight/pending", get(routes::oversight::get_pending))
        .route("/oversight/ledger", get(routes::oversight::get_ledger))
        .route("/oversight/settings", put(routes::oversight::update_settings))
        .route("/infra/providers", get(routes::model_manager::get_providers))
        .route("/infra/providers/:id", put(routes::model_manager::update_provider))
        .route("/infra/models", get(routes::model_manager::get_models))
        .route("/infra/models/:id", put(routes::model_manager::update_model))
        .route("/system/capabilities", get(routes::capabilities::get_capabilities))
        .route("/system/skills/:name", put(routes::capabilities::save_skill))
        .route("/system/skills/:name", axum::routing::delete(routes::capabilities::delete_skill))
        .route("/system/workflows/:name", put(routes::capabilities::save_workflow))
        .route("/system/workflows/:name", axum::routing::delete(routes::capabilities::delete_workflow))
        .route_layer(axum::middleware::from_fn_with_state(app_state.clone(), middleware::auth::validate_token));

    let app = Router::new()
        .route("/engine/health", get(routes::health::health_check))
        .route("/engine/deploy", post(routes::deploy::trigger_deploy))
        .route("/engine/kill", post(routes::engine_control::kill_agents))
        .route("/engine/shutdown", post(routes::engine_control::shutdown_engine))
        .route("/engine/ws", get(routes::ws::ws_handler))
        .route("/engine/transcribe", post(routes::audio::transcribe_audio))
        .merge(protected_routes)
        .with_state(app_state.clone())
        // CORS must be the *outermost* layer so it runs first, before Auth
        .layer(cors);

    if app_state.deploy_token == "tadpole-dev-token-2026" {
        tracing::warn!("⚠️  SECURITY WARNING: Using hardcoded fallback NEURAL_TOKEN. Set this env var in production!");
    }

    // 6. Start the Server
    // Defaults to Port 8000 to maintain compatibility with the legacy Node.js dashboard.
    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()?;
    
    tracing::info!("🚀 Tadpole OS Engine (Rust Edition) listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
