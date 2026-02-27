use sqlx::SqlitePool;
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;
use sqlx::Row;
use crate::agent::types::{Mission, MissionStatus, MissionLog};

/// Creates a new mission in the database.
pub async fn create_mission(pool: &SqlitePool, agent_id: &str, title: &str, budget_usd: f64) -> Result<Mission> {
    let mission_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    
    let mission = Mission {
        id: mission_id,
        agent_id: agent_id.to_string(),
        title: title.to_string(),
        status: MissionStatus::Pending,
        created_at: now,
        updated_at: now,
        budget_usd,
        cost_usd: 0.0,
    };

    // Diagnostic check: Does the agent exist?
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM agents WHERE id = ?")
        .bind(agent_id)
        .fetch_one(pool)
        .await?;
    
    if count == 0 {
        return Err(anyhow::anyhow!("Agent ID '{}' not found in database", agent_id));
    }

    sqlx::query(
        "INSERT INTO mission_history (id, agent_id, title, status, budget_usd, cost_usd, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
    .bind(&mission.id)
    .bind(&mission.agent_id)
    .bind(&mission.title)
    .bind("pending")
    .bind(mission.budget_usd)
    .bind(mission.cost_usd)
    .bind(mission.created_at)
    .bind(mission.updated_at)
    .execute(pool)
    .await?;

    Ok(mission)
}

/// Updates mission status and cost.
pub async fn update_mission(pool: &SqlitePool, mission_id: &str, status: MissionStatus, cost_usd: f64) -> Result<()> {
    let status_str = status_to_str(&status);
    let now = Utc::now();

    sqlx::query(
        "UPDATE mission_history SET status = ?1, cost_usd = cost_usd + ?2, updated_at = ?3 WHERE id = ?4")
    .bind(status_str)
    .bind(cost_usd)
    .bind(now)
    .bind(mission_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Logs a step for a specific mission.
pub async fn log_step(
    pool: &SqlitePool, 
    mission_id: &str, 
    agent_id: &str, 
    source: &str, 
    text: &str, 
    severity: &str, 
    metadata: Option<serde_json::Value>
) -> Result<MissionLog> {
    let log_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let metadata_json = metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());

    sqlx::query(
        "INSERT INTO mission_logs (id, mission_id, agent_id, source, text, severity, timestamp, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
    .bind(&log_id)
    .bind(mission_id)
    .bind(agent_id)
    .bind(source)
    .bind(text)
    .bind(severity)
    .bind(now)
    .bind(metadata_json)
    .execute(pool)
    .await?;

    Ok(MissionLog {
        id: log_id,
        mission_id: mission_id.to_string(),
        agent_id: agent_id.to_string(),
        source: source.to_string(),
        text: text.to_string(),
        severity: severity.to_string(),
        timestamp: now,
        metadata,
    })
}

#[allow(dead_code)]
pub async fn get_last_active_mission(pool: &SqlitePool, agent_id: &str) -> Result<Option<Mission>> {
    let row = sqlx::query(
        "SELECT * FROM mission_history WHERE agent_id = ?1 AND status IN ('pending', 'active') ORDER BY created_at DESC LIMIT 1")
    .bind(agent_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| row_to_mission(&r)))
}

/// Shares a finding to the swarm context bus.
pub async fn share_finding(pool: &SqlitePool, mission_id: &str, agent_id: &str, topic: &str, finding: &str) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO swarm_context (id, mission_id, agent_id, topic, finding) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(id)
    .bind(mission_id)
    .bind(agent_id)
    .bind(topic)
    .bind(finding)
    .execute(pool)
    .await?;
    Ok(())
}

/// Retrieves all findings for a mission to provide context to an agent.
pub async fn get_mission_context(pool: &SqlitePool, mission_id: &str) -> Result<String> {
    let rows = sqlx::query(
        "SELECT agent_id, topic, finding FROM swarm_context WHERE mission_id = ?1 ORDER BY timestamp ASC")
    .bind(mission_id)
    .fetch_all(pool)
    .await?;

    let mut context = String::new();
    for row in rows {
        let agent_id_row: String = row.get("agent_id");
        let topic: String = row.get("topic");
        let finding: String = row.get("finding");
        context.push_str(&format!("[Context from {} on {}]: {}\n", agent_id_row, topic, finding));
    }
    Ok(context)
}

/// Retrieves a mission by its ID.
pub async fn get_mission_by_id(pool: &SqlitePool, mission_id: &str) -> Result<Option<Mission>> {
    let row = sqlx::query(
        "SELECT * FROM mission_history WHERE id = ?1")
    .bind(mission_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| row_to_mission(&r)))
}

/// Retrieves recent missions for financial auditing.
pub async fn get_recent_missions(pool: &SqlitePool, limit: i64) -> Result<Vec<Mission>> {
    let rows = sqlx::query(
        "SELECT * FROM mission_history ORDER BY updated_at DESC LIMIT ?1")
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(row_to_mission).collect())
}

// ─────────────────────────────────────────────────────────
//  HELPERS  (DRY: eliminates 3× duplicated row mapping)
// ─────────────────────────────────────────────────────────

fn status_to_str(status: &MissionStatus) -> &'static str {
    match status {
        MissionStatus::Pending => "pending",
        MissionStatus::Active => "active",
        MissionStatus::Completed => "completed",
        MissionStatus::Failed => "failed",
        MissionStatus::Paused => "paused",
    }
}

fn str_to_status(s: &str) -> MissionStatus {
    match s {
        "active" => MissionStatus::Active,
        "completed" => MissionStatus::Completed,
        "failed" => MissionStatus::Failed,
        "paused" => MissionStatus::Paused,
        _ => MissionStatus::Pending,
    }
}

fn row_to_mission(row: &sqlx::sqlite::SqliteRow) -> Mission {
    let status_str: String = row.get("status");
    Mission {
        id: row.get("id"),
        agent_id: row.get("agent_id"),
        title: row.get("title"),
        status: str_to_status(&status_str),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        budget_usd: row.get("budget_usd"),
        cost_usd: row.get("cost_usd"),
    }
}
