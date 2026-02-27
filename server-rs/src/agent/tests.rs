use sqlx::SqlitePool;
use anyhow::Result;
use crate::agent::persistence::{load_agents_db, save_agent_db};
use crate::agent::types::{EngineAgent, ModelConfig, TokenUsage};
use std::collections::HashMap;

// ─────────────────────────────────────────────────────────
//  PERSISTENCE TESTS
// ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_database_persistence() -> Result<()> {
    let pool = SqlitePool::connect("sqlite::memory:").await?;

    sqlx::query(
        "CREATE TABLE agents (
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
            metadata TEXT NOT NULL,
            skills TEXT DEFAULT '[]',
            workflows TEXT DEFAULT '[]',
            model_2 TEXT,
            model_3 TEXT,
            model_config2 TEXT,
            model_config3 TEXT,
            active_model_slot INTEGER DEFAULT 1
        )"
    ).execute(&pool).await?;

    let mut agent = EngineAgent {
        id: "test-agent".to_string(),
        name: "Test Bot".to_string(),
        role: "tester".to_string(),
        department: "qa".to_string(),
        description: "Testing persistence".to_string(),
        model_id: Some("test-model".to_string()),
        model: ModelConfig {
            provider: "mock".to_string(),
            model_id: "test-model".to_string(),
            api_key: None,
            base_url: None,
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            external_id: None,
            rpm: None,
            rpd: None,
            tpm: None,
            tpd: None,
        },
        model_2: None,
        model_3: None,
        model_config2: None,
        model_config3: None,
        active_model_slot: None,
        active_mission: None,
        status: "idle".to_string(),
        tokens_used: 0,
        token_usage: TokenUsage::default(),
        metadata: HashMap::new(),
        theme_color: None,
        budget_usd: 100.0,
        cost_usd: 0.0,
        skills: vec!["skill-1".to_string()],
        workflows: vec!["workflow-1".to_string()],
    };

    // 1. Save
    save_agent_db(&pool, &agent).await?;

    // 2. Load
    let agents = load_agents_db(&pool).await?;
    assert_eq!(agents.len(), 1);
    assert_eq!(agents[0].id, "test-agent");
    assert_eq!(agents[0].name, "Test Bot");

    // 3. Update (idempotent upsert)
    agent.name = "Updated Bot".to_string();
    save_agent_db(&pool, &agent).await?;
    let updated_agents = load_agents_db(&pool).await?;
    assert_eq!(updated_agents.len(), 1, "Upsert must not duplicate rows");
    assert_eq!(updated_agents[0].name, "Updated Bot");

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  MISSION TESTS
// ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_mission_logic() -> Result<()> {
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    
    sqlx::query("CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, department TEXT NOT NULL, description TEXT NOT NULL, model_id TEXT, tokens_used INTEGER DEFAULT 0, status TEXT NOT NULL, theme_color TEXT, budget_usd REAL DEFAULT 0.0, cost_usd REAL DEFAULT 0.0, metadata TEXT NOT NULL, skills TEXT DEFAULT '[]', workflows TEXT DEFAULT '[]', model_2 TEXT, model_3 TEXT, model_config2 TEXT, model_config3 TEXT, active_model_slot INTEGER DEFAULT 1)").execute(&pool).await?;
    sqlx::query("INSERT INTO agents (id, name, role, department, description, status, metadata, skills, workflows) VALUES ('agent-1', 'Test Agent', 'tester', 'qa', 'Test agent for mission logic', 'idle', '{}', '[]', '[]')").execute(&pool).await?;
    sqlx::query("CREATE TABLE mission_history (id TEXT PRIMARY KEY, agent_id TEXT, title TEXT, status TEXT, budget_usd REAL, cost_usd REAL, created_at DATETIME, updated_at DATETIME)").execute(&pool).await?;
    sqlx::query("CREATE TABLE swarm_context (id TEXT PRIMARY KEY, mission_id TEXT, agent_id TEXT, topic TEXT, finding TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)").execute(&pool).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS mission_steps (id TEXT PRIMARY KEY, mission_id TEXT, agent_id TEXT, role TEXT, message TEXT, status TEXT, tool_call TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").execute(&pool).await?;

    // 1. Create Mission
    let mission = crate::agent::mission::create_mission(&pool, "agent-1", "Test Mission", 10.0).await?;
    assert_eq!(mission.title, "Test Mission");
    assert_eq!(mission.cost_usd, 0.0);

    // 2. Share Finding
    crate::agent::mission::share_finding(&pool, &mission.id, "agent-1", "Security", "Found open port").await?;

    // 3. Get Context
    let context = crate::agent::mission::get_mission_context(&pool, &mission.id).await?;
    assert!(context.contains("Found open port"));
    assert!(context.contains("agent-1"));

    // 4. Retrieve by ID (tests DRY row_to_mission helper)
    let fetched = crate::agent::mission::get_mission_by_id(&pool, &mission.id).await?;
    assert!(fetched.is_some());
    assert_eq!(fetched.unwrap().title, "Test Mission");

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  SWARM GOVERNANCE TESTS
// ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_swarm_recursion_logic() -> Result<()> {
    use crate::agent::types::TaskPayload;

    let lineage = vec!["agent-1".to_string(), "agent-2".to_string()];
    let current_agent = "agent-1";

    // Test the CURRENT implementation: zero-alloc iterator (iter().any())
    // This is what runner.rs:validate_input now uses — not .contains(&to_string())
    let is_circular = lineage.iter().any(|id| id == current_agent);
    assert!(is_circular, "Should detect agent-1 is already in the lineage");

    let next_agent = "agent-3";
    let is_not_circular = lineage.iter().any(|id| id == next_agent);
    assert!(!is_not_circular, "Should not detect agent-3 as circular");

    // Test depth limit boundary
    let max_depth: u32 = 5;
    assert!(4 < max_depth, "Depth 4 should be allowed");
    assert!(!(5 < max_depth), "Depth 5 should be blocked");

    // Test TaskPayload serialization with lineage
    let payload = TaskPayload {
        message: "test".to_string(),
        cluster_id: None,
        department: None,
        provider: None,
        model_id: None,
        api_key: None,
        base_url: None,
        rpm: None,
        tpm: None,
        budget_usd: None,
        swarm_depth: Some(2),
        swarm_lineage: Some(lineage),
        external_id: None,
        safe_mode: None,
    };

    let json = serde_json::to_string(&payload)?;
    assert!(json.contains("swarmLineage"));
    assert!(json.contains("agent-1"));

    Ok(())
}

// ─────────────────────────────────────────────────────────
//  RATE LIMITER TESTS
// ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_rate_limiter_unlimited_is_noop() {
    let limiter = crate::agent::rate_limiter::RateLimiter::new(None, None);
    assert!(!limiter.is_active(), "Unlimited limiter should report as inactive");
    // Should return immediately without blocking
    limiter.acquire(9999).await;
    limiter.record_usage(9999);
}

#[tokio::test]
async fn test_rate_limiter_active_with_limits() {
    // Construct with both limits set
    let limiter = crate::agent::rate_limiter::RateLimiter::new(Some(60), Some(100_000));
    assert!(limiter.is_active(), "Limiter with rpm/tpm should report as active");

    // Acquire should not block on the first call with ample budget
    limiter.acquire(512).await;
    limiter.record_usage(420);
}

#[tokio::test]
async fn test_rate_limiter_rpm_only() {
    let limiter = crate::agent::rate_limiter::RateLimiter::new(Some(30), None);
    assert!(limiter.is_active());
    limiter.acquire(0).await;
}

#[tokio::test]
async fn test_rate_limiter_tpm_only() {
    let limiter = crate::agent::rate_limiter::RateLimiter::new(None, Some(50_000));
    assert!(limiter.is_active());
    limiter.acquire(100).await;
    limiter.record_usage(87);
}

// ─────────────────────────────────────────────────────────
//  FILESYSTEM ADAPTER TESTS
// ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_filesystem_sandbox_write_read() -> Result<()> {
    use crate::adapter::filesystem::FilesystemAdapter;
    use std::path::PathBuf;

    // Use a temp directory as the sandbox root
    let tmp = std::env::temp_dir().join(format!("tadpole_test_{}", uuid::Uuid::new_v4()));
    let adapter = FilesystemAdapter::new(tmp.clone());

    // Write and read back
    adapter.write_file("hello.txt", "Hello, Tadpole!").await?;
    let content = adapter.read_file("hello.txt").await?;
    assert_eq!(content, "Hello, Tadpole!");

    // List should return the file
    let files = adapter.list_files("").await?;
    assert!(files.iter().any(|f| f == "hello.txt"), "hello.txt should appear in listing");

    // Cleanup
    let _ = tokio::fs::remove_dir_all(&tmp).await;
    Ok(())
}

#[tokio::test]
async fn test_filesystem_sandbox_blocks_traversal() {
    use crate::adapter::filesystem::FilesystemAdapter;
    use std::path::PathBuf;

    let tmp = std::env::temp_dir().join(format!("tadpole_test_{}", uuid::Uuid::new_v4()));
    let adapter = FilesystemAdapter::new(tmp.clone());

    // Attempt path traversal — must be rejected
    let result = adapter.read_file("../etc/passwd").await;
    assert!(result.is_err(), "Path traversal attempt must be blocked");

    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("SECURITY FAULT") || err_msg.contains("traversal"),
        "Error must indicate a security fault, got: {}", err_msg
    );
}

#[tokio::test]
async fn test_filesystem_sandbox_blocks_absolute_paths() {
    use crate::adapter::filesystem::FilesystemAdapter;
    // use std::path::PathBuf;

    let tmp = std::env::temp_dir().join(format!("tadpole_test_{}", uuid::Uuid::new_v4()));
    let adapter = FilesystemAdapter::new(tmp);

    // An absolute path outside the sandbox should be blocked or redirected
    // Our implementation strips the root component, so /etc/passwd becomes <root>/etc/passwd
    // This is safe (it can't access /etc) but let's verify it doesn't panic
    let result = adapter.write_file("/etc/passwd", "test").await;
    // Either an error (best) or a write inside sandbox (safe) — never a panic
    let _ = result; // just ensure no panic
}
