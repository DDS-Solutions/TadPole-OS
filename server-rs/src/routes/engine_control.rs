use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::state::AppState;

/// POST /engine/kill — Halt all running agents.
///
/// Sets every agent's status to "idle" and clears their active missions.
/// The server itself remains online. Use `/engine/shutdown` to stop the process.
pub async fn kill_agents(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let mut halted = 0usize;

    for mut entry in state.agents.iter_mut() {
        if entry.status == "active" || entry.status == "thinking" || entry.status == "coding" || entry.status == "speaking" {
            entry.status = "idle".to_string();
            entry.active_mission = None;
            halted += 1;
        }
    }

    // Abort all pending oversight entries — no point waiting for approval on halted agents
    let pending_ids: Vec<String> = state.oversight_queue.iter().map(|e| e.key().clone()).collect();
    for id in &pending_ids {
        state.oversight_queue.remove(id);
        if let Some((_, resolver)) = state.oversight_resolvers.remove(id) {
            let _ = resolver.send(false); // reject
        }
    }

    tracing::warn!("🛑 [Kill Switch] Halted {} agents, cleared {} pending oversight entries.", halted, pending_ids.len());

    state.emit_event(serde_json::json!({
        "type": "engine:kill",
        "haltedAgents": halted,
        "clearedOversight": pending_ids.len()
    }));

    (StatusCode::OK, Json(serde_json::json!({
        "status": "ok",
        "halted": halted,
        "clearedOversight": pending_ids.len()
    }))).into_response()
}

/// POST /engine/shutdown — Graceful server shutdown.
///
/// Persists all agent state to the database and then terminates the process.
/// The caller should expect the connection to drop after receiving the response.
pub async fn shutdown_engine(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    tracing::warn!("💀 [Shutdown] Engine shutdown requested by operator. Persisting state...");

    // Save all agents before shutting down
    state.save_agents().await;

    state.emit_event(serde_json::json!({
        "type": "engine:shutdown",
        "message": "Engine shutting down. Goodbye."
    }));

    // Spawn a delayed exit so the response can be sent first
    tokio::spawn(async {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        tracing::info!("👋 Engine process exiting.");
        std::process::exit(0);
    });

    (StatusCode::OK, Json(serde_json::json!({
        "status": "ok",
        "message": "Shutdown initiated. State persisted."
    }))).into_response()
}
