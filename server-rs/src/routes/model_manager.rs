use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::{
    agent::types::{ProviderConfig, ModelEntry},
    state::AppState,
};

/// Returns all configured AI providers.
pub async fn get_providers(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let providers: Vec<ProviderConfig> = state.providers.iter().map(|kv| kv.value().clone()).collect();
    Json(providers)
}

/// Updates or creates a provider configuration.
pub async fn update_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(config): Json<ProviderConfig>,
) -> impl IntoResponse {
    state.providers.insert(id.clone(), config);
    state.save_providers().await;
    (StatusCode::OK, Json(serde_json::json!({ "status": "updated", "id": id })))
}

/// Returns all available models in the registry.
pub async fn get_models(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let models: Vec<ModelEntry> = state.models.iter().map(|kv| kv.value().clone()).collect();
    Json(models)
}

/// Updates or creates a model entry.
pub async fn update_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(entry): Json<ModelEntry>,
) -> impl IntoResponse {
    state.models.insert(id.clone(), entry);
    state.save_models().await;
    (StatusCode::OK, Json(serde_json::json!({ "status": "updated", "id": id })))
}
