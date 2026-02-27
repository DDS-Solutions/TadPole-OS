use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use crate::state::AppState;

/// Middleware to validate the Bearer token in the Authorization header.
pub async fn validate_token(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|val| val.to_str().ok());

    match auth_header {
        Some(auth_str) if auth_str.starts_with("Bearer ") => {
            let token = &auth_str[7..];
            if token == state.deploy_token {
                Ok(next.run(req).await)
            } else {
                tracing::warn!("🚫 Invalid token provided in Authorization header");
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        _ => {
            tracing::warn!("🚫 Missing or malformed Authorization header");
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}
