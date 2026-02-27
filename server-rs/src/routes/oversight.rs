use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::state::AppState;
use crate::{
    agent::types::{OversightEntry, OversightDecision},
    routes::error::ProblemDetails,
};

/// GET /oversight/pending
/// Returns all entries currently awaiting a human decision.
pub async fn get_pending(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let entries: Vec<OversightEntry> = state
        .oversight_queue
        .iter()
        .map(|entry| entry.value().clone())
        .collect();
    Json(entries)
}

/// GET /oversight/ledger
/// Returns a snapshot of recently decided entries.
///
/// Note: The in-memory ledger is bounded to the last 200 entries to
/// prevent unbounded memory growth on long-running sessions.
pub async fn get_ledger(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let entries: Vec<serde_json::Value> = state
        .oversight_ledger
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .cloned()
        .collect();
    Json(entries)
}

#[derive(serde::Deserialize)]
pub struct OversightSettingsPayload {
    #[serde(rename = "autoApproveSafeSkills")]
    pub auto_approve_safe_skills: bool,
}

/// PUT /oversight/settings
/// Updates the global governance settings for the engine.
pub async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<OversightSettingsPayload>,
) -> impl IntoResponse {
    state.auto_approve_safe_skills.store(
        payload.auto_approve_safe_skills,
        std::sync::atomic::Ordering::Relaxed
    );
    
    tracing::info!("🛡️ Governance updated: Auto-Approve Safe Skills = {}", payload.auto_approve_safe_skills);
    
    (StatusCode::OK, Json(serde_json::json!({
        "status": "ok",
        "autoApproveSafeSkills": payload.auto_approve_safe_skills
    })))
}

/// POST /oversight/:id/decide
/// Approves or rejects a pending entry.
pub async fn decide_oversight(
    Path(entry_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<OversightDecision>,
) -> impl IntoResponse {
    tracing::info!("⚖️ [Oversight] Decision for {}: {}", entry_id, payload.decision);

    let approved = payload.decision == "approved";
    
    // 1. Remove from the pending queue
    let removed_entry = state.oversight_queue.remove(&entry_id);
    
    if removed_entry.is_none() {
        return ProblemDetails::new(
            StatusCode::NOT_FOUND,
            "Oversight Entry Not Found",
            format!("Cannot process decision because oversight ID '{}' does not exist or has already been decided.", entry_id)
        ).into_response();
    }

    // 2. Resolve the awaiting oneshot channel
    if let Some((_, shooter)) = state.oversight_resolvers.remove(&entry_id) {
        let _ = shooter.send(approved);
    }

    // 3. Record the decision in the ledger
    {
        let ledger_entry = serde_json::json!({
            "id": entry_id,
            "decision": payload.decision,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "decidedBy": "user",
            "toolCall": removed_entry.and_then(|(_, e)| e.tool_call).map(|tc| serde_json::json!({
                "agentId": tc.agent_id,
                "skill": tc.skill,
                "params": tc.params,
                "description": tc.description,
                "clusterId": tc.department
            }))
        });
        if let Ok(mut ledger) = state.oversight_ledger.lock() {
            ledger.insert(0, ledger_entry);
            ledger.truncate(200);
        }
    }

    // 4. Broadcast the decision event
    state.emit_event(serde_json::json!({
        "type": "oversight:decided",
        "entry": {
            "id": entry_id,
            "decision": payload.decision,
            "decidedBy": "user",
            "decidedAt": chrono::Utc::now().to_rfc3339()
        }
    }));

    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" }))).into_response()
}
