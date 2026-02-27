use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::{
    agent::{runner::AgentRunner, types::{EngineAgent, TaskPayload}},
    state::AppState,
    routes::error::ProblemDetails,
};

/// GET /agents endpoint.
/// Serves the current state of all agents from the DashMap.
pub async fn get_agents(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let agents: Vec<EngineAgent> = state.agents.iter().map(|kv| kv.value().clone()).collect();
    Json(agents)
}

/// POST /agents/:id/send endpoint.
pub async fn send_task(
    Path(agent_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TaskPayload>,
) -> impl IntoResponse {
    tracing::info!("📡 [Gateway] Received Task '{}' for Agent {}", payload.message, agent_id);
    
    // Verify agent exists
    if !state.agents.contains_key(&agent_id) {
        tracing::warn!("⚠️ Agent {} not found in registry.", agent_id);
        return ProblemDetails::new(
            StatusCode::NOT_FOUND,
            "Agent Not Found",
            format!("Cannot send task because agent '{}' does not exist in the registry.", agent_id)
        ).into_response();
    }

    // Spawn Agent process asynchronously 
    let agent_id_for_spawn = agent_id.clone();
    tokio::spawn(async move {
        let runner = AgentRunner::new(state.clone());
        if let Err(e) = runner.run(agent_id_for_spawn.clone(), payload).await {
            tracing::error!("❌ [Runner] Agent {} task failed: {}", agent_id_for_spawn, e);
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(serde_json::json!({
            "status": "accepted",
            "agentId": agent_id
        }))
    ).into_response()
}

/// POST /agents endpoint.
/// Registers a new agent in the global registry and triggers persistence.
pub async fn create_agent(
    State(state): State<Arc<AppState>>,
    Json(new_agent): Json<EngineAgent>,
) -> impl IntoResponse {
    tracing::info!("🆕 [Registry] Creating New Agent {}: {}", new_agent.id, new_agent.name);

    state.agents.insert(new_agent.id.clone(), new_agent.clone());

    // Broadcast the creation to all UIs instantly
    state.emit_event(serde_json::json!({
        "type": "agent:create",
        "agentId": new_agent.id,
        "data": new_agent
    }));
    
    // Trigger background persistence
    state.save_agents().await;
    
    (StatusCode::CREATED, Json(serde_json::json!({ "status": "ok", "agentId": new_agent.id })))
}

/// PUT /agents/:id endpoint.
/// Allows the frontend to persist role/model/metadata changes.
pub async fn update_agent(
    Path(agent_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(update): Json<crate::agent::types::AgentConfigUpdate>,
) -> impl IntoResponse {
    tracing::info!("🔄 [Registry] Updating Agent {}: {:?}", agent_id, update);

    if let Some(mut entry) = state.agents.get_mut(&agent_id) {
        if let Some(name) = update.name { entry.name = name; }
        if let Some(role) = update.role { entry.role = role; }
        if let Some(dept) = update.department { entry.department = dept; }
        if let Some(model_id) = update.model_id { 
            entry.model_id = Some(model_id.clone()); 
            entry.model.model_id = model_id; 
        }
        if let Some(provider) = update.provider { entry.model.provider = provider; }
        if let Some(temp) = update.temperature { entry.model.temperature = Some(temp); }
        if let Some(prompt) = update.system_prompt { entry.model.system_prompt = Some(prompt); }
        if let Some(api_key) = update.api_key { entry.model.api_key = Some(api_key); }
        if let Some(color) = update.theme_color { entry.theme_color = Some(color); }
        if let Some(budget) = update.budget_usd { entry.budget_usd = budget; }
        if let Some(skills) = update.skills { entry.skills = skills; }
        if let Some(workflow) = update.workflows { entry.workflows = workflow; }
        if let Some(m2) = update.model2 { entry.model_2 = Some(m2); }
        if let Some(m3) = update.model3 { entry.model_3 = Some(m3); }
        if let Some(active_slot) = update.active_model_slot { entry.active_model_slot = Some(active_slot); }
        if let Some(mc2) = update.model_config2 { entry.model_config2 = Some(mc2); }
        if let Some(mc3) = update.model_config3 { entry.model_config3 = Some(mc3); }
        
        // Broadcast the update to all UIs instantly
        state.emit_event(serde_json::json!({
            "type": "agent:update",
            "agentId": agent_id,
            "data": *entry
        }));
        
        // Trigger background persistence to avoid blocking the HTTP response
        let state_clone = state.clone();
        tokio::spawn(async move {
            state_clone.save_agents().await;
        });
        
        Json(serde_json::json!({ "status": "ok" })).into_response()
    } else {
        ProblemDetails::new(
            StatusCode::NOT_FOUND,
            "Agent Not Found",
            format!("Failed to update agent because ID '{}' does not exist.", agent_id)
        ).into_response()
    }
}

/// POST /agents/:id/pause endpoint.
pub async fn pause_agent(
    Path(agent_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    tracing::info!("Pause Agent {}", agent_id);

    if let Some(mut entry) = state.agents.get_mut(&agent_id) {
        entry.status = "idle".to_string();
        
        state.emit_event(serde_json::json!({
            "type": "agent:update",
            "agentId": agent_id,
            "data": *entry
        }));
        
        let state_clone = state.clone();
        tokio::spawn(async move {
            state_clone.save_agents().await;
        });
        
        Json(serde_json::json!({ "status": "ok" })).into_response()
    } else {
        ProblemDetails::new(
            StatusCode::NOT_FOUND,
            "Agent Not Found",
            format!("Cannot pause agent '{}' because it does not exist.", agent_id)
        ).into_response()
    }
}

/// POST /agents/:id/resume endpoint.
pub async fn resume_agent(
    Path(agent_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    tracing::info!("Resume Agent {}", agent_id);

    if let Some(mut entry) = state.agents.get_mut(&agent_id) {
        entry.status = "active".to_string();
        
        state.emit_event(serde_json::json!({
            "type": "agent:update",
            "agentId": agent_id,
            "data": *entry
        }));
        
        let state_clone = state.clone();
        tokio::spawn(async move {
            state_clone.save_agents().await;
        });
        
        Json(serde_json::json!({ "status": "ok" })).into_response()
    } else {
        ProblemDetails::new(
            StatusCode::NOT_FOUND,
            "Agent Not Found",
            format!("Cannot resume agent '{}' because it does not exist.", agent_id)
        ).into_response()
    }
}



#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::agent::types::{EngineAgent, ModelConfig, TokenUsage};
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_create_agent_handler() {
        let state = Arc::new(AppState::new().await);
        let agent_id = "test-new-agent".to_string();
        
        let new_agent = EngineAgent {
            id: agent_id.clone(),
            name: "Test Agent".to_string(),
            role: "tester".to_string(),
            department: "QA".to_string(),
            description: "Internal Test Node".to_string(),
            model_id: Some("gpt-4o".to_string()),
            model: ModelConfig {
                provider: "openai".to_string(),
                model_id: "gpt-4o".to_string(),
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
            model_config2: None,
            model_config3: None,
            active_model_slot: None,
            active_mission: None,
            status: "idle".to_string(),
            tokens_used: 0,
            token_usage: TokenUsage::default(),
            metadata: HashMap::new(),
            theme_color: None,
            budget_usd: 100.0,
            cost_usd: 0.0,
            skills: vec!["skill-1".to_string()],
            workflows: vec!["workflow-1".to_string()],
        };

        let response = create_agent(State(state.clone()), Json(new_agent)).await.into_response();
        
        assert_eq!(response.status(), axum::http::StatusCode::CREATED);
        
        // Verify it was inserted into the registry
        assert!(state.agents.contains_key(&agent_id));
        let registered = state.agents.get(&agent_id).unwrap();
        assert_eq!(registered.name, "Test Agent");
    }
}
