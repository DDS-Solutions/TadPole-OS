use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use crate::state::AppState;

#[derive(Serialize)]
pub struct DeployResponse {
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// POST /engine/deploy — Triggers the deployment pipeline.
///
/// **Security**: Requires a valid `Authorization: Bearer <NEURAL_TOKEN>` header.
/// The token is read from the `NEURAL_TOKEN` environment variable at startup.
/// Rejects all requests without a matching token with 401 Unauthorized.
///
/// **Async**: Uses `tokio::process::Command` to avoid blocking the Tokio runtime
/// while the PowerShell deployment script runs.
pub async fn trigger_deploy(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // --- Authentication Gate ---
    let expected_token = &state.deploy_token;

    let provided = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    match provided {
        Some(token) if token == expected_token => {}
        _ => {
            tracing::warn!("🚫 Unauthorized deploy attempt blocked.");
            return (
                StatusCode::UNAUTHORIZED,
                Json(DeployResponse {
                    status: "unauthorized".to_string(),
                    output: None,
                    error: Some("Missing or invalid Authorization header.".to_string()),
                }),
            );
        }
    }

    tracing::info!("🚀 Authenticated deploy triggered. Running deploy.ps1...");

    // --- Async Process Execution ---
    let result = tokio::process::Command::new("powershell.exe")
        .args(["-ExecutionPolicy", "Bypass", "-File", "deploy.ps1"])
        .output()
        .await;

    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if output.status.success() {
                tracing::info!("✅ Deployment succeeded.");
                if !stderr.is_empty() {
                    tracing::warn!("⚠️ Deployment stderr:\n{}", stderr);
                }
                (
                    StatusCode::OK,
                    Json(DeployResponse {
                        status: "success".to_string(),
                        output: Some(stdout),
                        error: None,
                    }),
                )
            } else {
                tracing::error!("❌ Deployment failed (non-zero exit):\n{}", stderr);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(DeployResponse {
                        status: "error".to_string(),
                        output: Some(stdout),
                        error: Some(stderr),
                    }),
                )
            }
        }
        Err(e) => {
            tracing::error!("❌ Failed to spawn PowerShell process: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeployResponse {
                    status: "error".to_string(),
                    output: None,
                    error: Some(e.to_string()),
                }),
            )
        }
    }
}
