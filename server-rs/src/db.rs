use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use anyhow::Result;

pub async fn init_db(database_url: &str) -> Result<SqlitePool> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options).await?;

    // Create tables
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT NOT NULL,
            description TEXT NOT NULL,
            model_id TEXT,
            tokens_used INTEGER DEFAULT 0,
            status TEXT NOT NULL,
            theme_color TEXT,
            budget_usd REAL DEFAULT 0.0,
            cost_usd REAL DEFAULT 0.0,
            metadata TEXT NOT NULL, -- JSON blob
            model_2 TEXT,
            model_3 TEXT,
            model_config2 TEXT, -- JSON blob
            model_config3 TEXT, -- JSON blob
            active_model_slot INTEGER DEFAULT 1
        )"
    ).execute(&pool).await?;

    // Migration: Add columns if they don't exist (SQLite doesn't support IF NOT EXISTS for columns easily in one line)
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN budget_usd REAL DEFAULT 0.0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN cost_usd REAL DEFAULT 0.0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN skills TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN workflows TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model_2 TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model_3 TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model_config2 TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model_config3 TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE agents ADD COLUMN active_model_slot INTEGER DEFAULT 1").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE mission_history ADD COLUMN budget_usd REAL DEFAULT 0.0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE mission_history ADD COLUMN cost_usd REAL DEFAULT 0.0").execute(&pool).await;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mission_history (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            budget_usd REAL DEFAULT 0.0,
            cost_usd REAL DEFAULT 0.0,
            FOREIGN KEY(agent_id) REFERENCES agents(id)
        )"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mission_logs (
            id TEXT PRIMARY KEY,
            mission_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            source TEXT NOT NULL, -- 'User' | 'System' | 'Agent'
            text TEXT NOT NULL,
            severity TEXT NOT NULL, -- 'info' | 'success' | 'warning' | 'error'
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT, -- JSON blob
            FOREIGN KEY(mission_id) REFERENCES mission_history(id)
        )"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS oversight_log (
            id TEXT PRIMARY KEY,
            mission_id TEXT,
            agent_id TEXT NOT NULL,
            skill TEXT NOT NULL,
            params TEXT NOT NULL, -- JSON blob
            status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(mission_id) REFERENCES mission_history(id)
        )"
    ).execute(&pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS swarm_context (
            id TEXT PRIMARY KEY,
            mission_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            finding TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(mission_id) REFERENCES mission_history(id)
        )"
    ).execute(&pool).await?;

    Ok(pool)
}
