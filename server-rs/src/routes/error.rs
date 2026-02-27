use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// RFC 9457 (Problem Details for HTTP APIs) compliant error structure.
/// This format ensures top-tier industry standards for machine-readable error responses.
#[derive(Debug, Serialize)]
pub struct ProblemDetails {
    #[serde(rename = "type")]
    pub type_url: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,
    /// Legacy field for backward compatibility with frontend parts still expecting "message"
    pub message: String,
}

impl ProblemDetails {
    pub fn new(status: StatusCode, title: impl Into<String>, detail: impl Into<String>) -> Self {
        let detail_str = detail.into();
        Self {
            type_url: format!("https://httpstatuses.com/{}", status.as_u16()),
            title: title.into(),
            status: status.as_u16(),
            detail: detail_str.clone(),
            instance: None,
            message: detail_str,
        }
    }
}

impl IntoResponse for ProblemDetails {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}
