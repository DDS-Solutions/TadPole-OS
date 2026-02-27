use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::state::AppState;
use serde_json::json;

pub async fn transcribe_audio(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut audio_data = Vec::new();
    let mut filename = "speech.wav".to_string();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            filename = field.file_name().unwrap_or("speech.wav").to_string();
            audio_data = field.bytes().await.map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?.to_vec();
        }
    }

    if audio_data.is_empty() {
        return Err((axum::http::StatusCode::BAD_REQUEST, "No audio file provided".to_string()));
    }

    // Initialize Groq Provider for transcription using the shared HTTP client
    let (api_key, model_id) = if let Some(groq_provider) = state.providers.get("groq") {
        let key = groq_provider.api_key.clone()
            .or_else(|| std::env::var("GROQ_API_KEY").ok())
            .ok_or_else(|| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Missing GROQ_API_KEY".to_string()))?;
        
        let model = groq_provider.audio_model.clone()
            .unwrap_or_else(|| "whisper-large-v3".to_string());
            
        (key, model)
    } else {
        let key = std::env::var("GROQ_API_KEY")
            .map_err(|_| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Missing GROQ_API_KEY".to_string()))?;
        (key, "whisper-large-v3".to_string())
    };
    
    let config = crate::agent::types::ModelConfig {
        provider: "groq".to_string(),
        model_id,
        api_key: Some(api_key.clone()),
        base_url: None,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
        external_id: None,
        rpm: None,
        rpd: None,
        tpm: None,
        tpd: None,
    };

    // Use the shared HTTP client from AppState (PERF-01 fix)
    let client = (*state.http_client).clone();
    let provider = crate::agent::groq::GroqProvider::new(client, api_key, config);
    
    let text = provider.transcribe(audio_data, &filename).await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "text": text
    })))
}
