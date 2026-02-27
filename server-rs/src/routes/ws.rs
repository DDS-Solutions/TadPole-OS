use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use crate::state::AppState;

/// The HTTP upgrade endpoint for WebSockets.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let token = params.get("token");

    if let Some(t) = token {
        if t == &state.deploy_token {
            tracing::info!("✅ WebSocket handshake authorized.");
            return ws.on_upgrade(move |socket| handle_socket(socket, state)).into_response();
        } else {
            tracing::warn!("🚫 Unauthorized WebSocket: Token mismatch. Received: {}... Expected: {}...", 
                &t[..std::cmp::min(4, t.len())],
                &state.deploy_token[..std::cmp::min(4, state.deploy_token.len())]
            );
        }
    } else {
        tracing::warn!("🚫 Unauthorized WebSocket: No token provided in query params");
    }

    (axum::http::StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
}

/// The actual bi-directional WebSocket loop handling messaging.
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut _receiver) = socket.split();

    // Subscribe to both Log entries and Engine events
    let mut log_rx = state.tx.subscribe();
    let mut event_rx = state.event_tx.subscribe();

    tracing::info!("🔗 High-Performance WebSocket Connected!");

    // Tell the frontend we connected in Rust.
    state.broadcast_sys("Connected to Tadpole OS [Rust Engine v0.1.0]", "success");

    // Spawn a task that constantly reads our global Broadcast channels
    // and instantly forwards to this specific WebSocket connection
    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // 1. Handle System Logs (LogEntry)
                result = log_rx.recv() => {
                    if let Ok(msg) = result {
                        if let Ok(json_str) = serde_json::to_string(&msg) {
                            if sender.send(Message::Text(json_str)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                
                // 2. Handle Engine Events (serde_json::Value)
                result = event_rx.recv() => {
                    if let Ok(msg) = result {
                        if let Ok(json_str) = serde_json::to_string(&msg) {
                            if sender.send(Message::Text(json_str)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
        }
    });

    // Keep the task alive until it closes
    let _ = tokio::join!(&mut send_task);

    tracing::info!("🔗 WebSocket Disconnected.");
}
