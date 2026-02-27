use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::state::AppState;
use crate::agent::capabilities::{SkillDefinition, WorkflowDefinition};
use crate::routes::error::ProblemDetails;

// GET /system/capabilities
pub async fn get_capabilities(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let mut skills = Vec::new();
    let mut workflows = Vec::new();

    for kv in state.capabilities.skills.iter() {
        skills.push(kv.value().clone());
    }

    for kv in state.capabilities.workflows.iter() {
        workflows.push(kv.value().clone());
    }

    (StatusCode::OK, Json(json!({
        "skills": skills,
        "workflows": workflows
    })))
}

// PUT /system/skills/:name
pub async fn save_skill(
    Path(_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SkillDefinition>,
) -> impl IntoResponse {
    match state.capabilities.save_skill(payload.clone()).await {
        Ok(_) => (StatusCode::OK, Json(json!({"status": "success", "skill": payload}))).into_response(),
        Err(e) => ProblemDetails::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Skill Save Failed",
            format!("The system could not persist the skill '{}': {}", payload.name, e)
        ).into_response()
    }
}

// DELETE /system/skills/:name
pub async fn delete_skill(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match state.capabilities.delete_skill(&name).await {
        Ok(_) => (StatusCode::OK, Json(json!({"status": "success"}))).into_response(),
        Err(e) => ProblemDetails::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Skill Deletion Failed",
            format!("The system could not delete the skill '{}': {}", name, e)
        ).into_response()
    }
}

// PUT /system/workflows/:name
pub async fn save_workflow(
    Path(_name): Path<String>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WorkflowDefinition>,
) -> impl IntoResponse {
    match state.capabilities.save_workflow(payload.clone()).await {
        Ok(_) => (StatusCode::OK, Json(json!({"status": "success", "workflow": payload}))).into_response(),
        Err(e) => ProblemDetails::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Workflow Save Failed",
            format!("The system could not persist the workflow '{}': {}", payload.name, e)
        ).into_response()
    }
}

// DELETE /system/workflows/:name
pub async fn delete_workflow(
    Path(name): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match state.capabilities.delete_workflow(&name).await {
        Ok(_) => (StatusCode::OK, Json(json!({"status": "success"}))).into_response(),
        Err(e) => ProblemDetails::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Workflow Deletion Failed",
            format!("The system could not delete the workflow '{}': {}", name, e)
        ).into_response()
    }
}
