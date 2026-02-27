use reqwest::Client;
use serde::Serialize;
use anyhow::Result;

pub struct DiscordAdapter {
    pub webhook_url: String,
    client: Client,
}

#[derive(Debug, Serialize)]
struct DiscordMessage {
    content: String,
    username: String,
    avatar_url: Option<String>,
}

impl DiscordAdapter {
    pub fn new(webhook_url: String) -> Self {
        Self {
            webhook_url,
            client: Client::new(),
        }
    }

    /// Sends a notification to a Discord channel via webhook.
    pub async fn notify(&self, agent_name: &str, text: &str) -> Result<()> {
        let msg = DiscordMessage {
            content: text.to_string(),
            username: format!("Tadpole OS: {}", agent_name),
            avatar_url: None, // Could use specific icons for roles
        };

        let res = self.client.post(&self.webhook_url)
            .json(&msg)
            .send()
            .await?;

        if !res.status().is_success() {
            let err = res.text().await?;
            return Err(anyhow::anyhow!("Discord Webhook Error: {}", err));
        }

        Ok(())
    }
}
