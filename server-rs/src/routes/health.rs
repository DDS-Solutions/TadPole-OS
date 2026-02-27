use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub heartbeat: String,
}

/// A simple heartbeat endpoint that mirrors the old `router.get("/health")` in Express.
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "tadpole_online_rust".to_string(),
        heartbeat: chrono::Utc::now().to_rfc3339(),
    })
}
