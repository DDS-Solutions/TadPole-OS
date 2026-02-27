use crate::agent::types::{TaskPayload, ModelConfig, TokenUsage};
use crate::state::AppState;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;
use crate::agent::hooks::HookContext;

/// Context bag for data resolved during the setup phase of a run.
/// Avoids passing 10+ arguments between helpers.
#[derive(Clone)]
struct RunContext {
    agent_id: String,
    name: String,
    role: String,
    department: String,
    description: String,
    model_config: ModelConfig,
    skills: Vec<String>,
    workflows: Vec<String>,
    mission_id: String,
    depth: u32,
    lineage: Vec<String>,
    provider_name: String,
    workspace_root: std::path::PathBuf,
    safe_mode: bool,
}

#[derive(Clone)]
pub struct AgentRunner {
    pub state: Arc<AppState>,
}

impl AgentRunner {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    // ─────────────────────────────────────────────────────────
    //  MAIN ENTRY POINT
    // ─────────────────────────────────────────────────────────

    /// The core execution loop for a mission.
    pub async fn run(&self, agent_id: String, payload: TaskPayload) -> anyhow::Result<String> {
        // 0. Input Validation & Safety Checks
        self.validate_input(&agent_id, &payload)?;

        let depth = payload.swarm_depth.unwrap_or(0);
        let lineage = payload.swarm_lineage.clone().unwrap_or_default();

        // 0.1 Mission Initialization
        let mission_title = payload.message.chars().take(50).collect::<String>() + "...";
        
        let agent_budget = self.state.agents.get(&agent_id)
            .map(|a| a.value().budget_usd)
            .unwrap_or(0.0);
            
        let mission_budget = payload.budget_usd
            .unwrap_or_else(|| if agent_budget > 0.0 { agent_budget } else { 1.0 });

        let mission = crate::agent::mission::create_mission(
            &self.state.pool, 
            &agent_id, 
            &mission_title, 
            mission_budget
        ).await?;
        let mission_id = mission.id;
        
        // Initial system check and mission activation
        crate::agent::mission::update_mission(&self.state.pool, &mission_id, crate::agent::types::MissionStatus::Active, 0.0).await?;
        
        crate::agent::mission::log_step(
            &self.state.pool,
            &mission_id,
            &agent_id,
            "User",
            &payload.message,
            "info",
            None
        ).await?;

        // 1. Resolve agent config and build context
        let ctx = self.resolve_agent_context(&agent_id, &payload, &mission_id, depth, &lineage)?;

        tracing::info!("🏃 [Runner] Starting task for Agent {} (Model: {})", ctx.name, ctx.model_config.model_id);
        
        let hierarchy_label = match depth {
            0 => "OVERLORD (Strategic Intelligence Lead)",
            1 => "ALPHA NODE (Swarm Mission Commander)",
            2 => "CLUSTER ALPHA NODE (Department Coordinator)",
            _ => "AGENT (Task Specialist)",
        };

        self.state.broadcast_sys(&format!("Agent {} starting task ({})...", ctx.name, hierarchy_label), "info");

        // 1.1 Build system prompt
        let system_prompt = self.build_system_prompt(&ctx, hierarchy_label).await;

        self.broadcast_agent_status(&agent_id, "thinking");
        crate::agent::mission::log_step(
            &self.state.pool,
            &mission_id,
            &agent_id,
            "System",
            &format!("Agent {} is thinking...", ctx.name),
            "info",
            None
        ).await?;

        // 2. Define Tools & Call Provider
        let swarm_tool = self.build_tools(&ctx);

        let result = self.call_provider(&ctx, &system_prompt, &payload.message, Some(vec![swarm_tool])).await;

        let (mut output_text, function_calls, mut usage) = match result {
            Ok(data) => data,
            Err(e) => {
                self.handle_provider_error(&ctx, &e).await?;
                return Err(e);
            }
        };

        // 3. Fiscal Governance: Cost Tracking & Budget Enforcement
        let step_cost = crate::agent::rates::calculate_cost(
            &ctx.model_config.model_id, 
            usage.as_ref().map(|u| u.input_tokens).unwrap_or(0), 
            usage.as_ref().map(|u| u.output_tokens).unwrap_or(0)
        );

        if let Some(budget_msg) = self.check_budget(&ctx, step_cost, &output_text).await? {
            return Ok(budget_msg);
        }

        // 4. Handle Tool Loop (The "Intelligence" Layer)
        if !function_calls.is_empty() {
            use futures::stream::{FuturesUnordered, StreamExt};
            
            let mut futures = FuturesUnordered::new();
            for fc in function_calls {
                let runner = self.clone();
                let ctx_clone = ctx.clone();
                let user_msg = payload.message.clone();
                
                futures.push(async move {
                    let mut local_text = String::new();
                    let mut local_usage = None;
                    let result = runner.execute_tool(&ctx_clone, &fc, &mut local_text, &mut local_usage, &user_msg).await;
                    (result, local_text, local_usage)
                });
            }

            while let Some((result, local_text, local_usage)) = futures.next().await {
                if let Some(early_return) = result? {
                    return Ok(early_return);
                }
                output_text.push_str(&local_text);
                self.accumulate_usage(&mut usage, local_usage);
            }
        }

        // 5. Finalize
        self.finalize_run(&ctx, &output_text, &usage).await
    }

    // ─────────────────────────────────────────────────────────
    //  VALIDATION
    // ─────────────────────────────────────────────────────────

    /// Validates input constraints before execution begins.
    fn validate_input(&self, agent_id: &str, payload: &TaskPayload) -> anyhow::Result<()> {
        const MAX_TASK_LENGTH: usize = 32768;
        if payload.message.len() > MAX_TASK_LENGTH {
            return Err(anyhow::anyhow!("❌ Task message too long ({} bytes, max {})", payload.message.len(), MAX_TASK_LENGTH));
        }

        let depth = payload.swarm_depth.unwrap_or(0);
        let lineage = payload.swarm_lineage.as_deref().unwrap_or(&[]);

        // CODE-01 FIX: Use iterator instead of to_string() allocation on hot path.
        if lineage.iter().any(|id| id == agent_id) {
            let path = lineage.join(" -> ");
            return Err(anyhow::anyhow!("🐝 CIRCULAR RECURSION DETECTED: Agent '{}' has already participated in this mission chain (Lineage: {} -> {}). Recruitment aborted.", agent_id, path, agent_id));
        }

        const MAX_SWARM_DEPTH: u32 = 5;
        if depth >= MAX_SWARM_DEPTH {
            return Err(anyhow::anyhow!("🐝 Swarm depth limit exceeded (current depth: {})! To prevent infinite recursions, this agent cannot spawn more sub-agents.", depth));
        }

        Ok(())
    }

    // ─────────────────────────────────────────────────────────
    //  CONTEXT RESOLUTION
    // ─────────────────────────────────────────────────────────

    /// Resolves the full agent context from registries, applying payload overrides.
    fn resolve_agent_context(
        &self,
        agent_id: &str,
        payload: &TaskPayload,
        mission_id: &str,
        depth: u32,
        lineage: &[String],
    ) -> anyhow::Result<RunContext> {
        let entry = self.state.agents.get(agent_id)
            .ok_or_else(|| anyhow::anyhow!("Agent {} not found", agent_id))?;
        let a = entry.value();
        
        let target_model_id = payload.model_id.clone()
            .or_else(|| a.model_id.clone())
            .unwrap_or_else(|| a.model.model_id.clone());
        
        // CENTRAL REGISTRY PATH: Resolve full config from model + provider registries
        let mut resolved_config = if let Some(model_entry) = self.state.models.get(&target_model_id) {
            let model_id = model_entry.id.clone();
            let provider_id = model_entry.provider_id.clone();
            
            let provider_config = self.state.providers.get(&provider_id)
                .ok_or_else(|| anyhow::anyhow!("Provider {} not found for model {}", provider_id, target_model_id))?;
            
            ModelConfig {
                provider: provider_config.protocol.clone(),
                model_id,
                api_key: provider_config.api_key.clone(),
                base_url: provider_config.base_url.clone(),
                system_prompt: a.model.system_prompt.clone(),
                temperature: a.model.temperature,
                max_tokens: a.model.max_tokens,
                external_id: provider_config.external_id.clone(),
                rpm: model_entry.rpm,
                rpd: model_entry.rpd,
                tpm: model_entry.tpm,
                tpd: model_entry.tpd,
            }
        } else if let Some(found_entry) = self.state.models.iter().find(|kv| kv.value().name.to_lowercase() == target_model_id.to_lowercase()) {
            // FUZZY RESOLUTION: ID might be a friendly name from the UI
            let m = found_entry.value();
            let model_id = m.id.clone();
            let provider_id = m.provider_id.clone();
            
            let provider_config = self.state.providers.get(&provider_id)
                .ok_or_else(|| anyhow::anyhow!("Provider {} not found for model {}", provider_id, m.name))?;
            
            ModelConfig {
                provider: provider_config.protocol.clone(),
                model_id,
                api_key: provider_config.api_key.clone(),
                base_url: provider_config.base_url.clone(),
                system_prompt: a.model.system_prompt.clone(),
                temperature: a.model.temperature,
                max_tokens: a.model.max_tokens,
                external_id: provider_config.external_id.clone(),
                rpm: m.rpm,
                rpd: m.rpd,
                tpm: m.tpm,
                tpd: m.tpd,
            }
        } else {
            // FALLBACK: Use agent's internal model config
            let mut cfg = a.model.clone();
            cfg.model_id = target_model_id;
            cfg
        };

        // Mission-specific overrides from payload
        if let Some(p) = &payload.provider { resolved_config.provider = p.clone(); }
        if let Some(key) = &payload.api_key { resolved_config.api_key = Some(key.clone()); }
        if let Some(url) = &payload.base_url { resolved_config.base_url = Some(url.clone()); }
        if let Some(eid) = &payload.external_id { resolved_config.external_id = Some(eid.clone()); }
        if let Some(m) = &payload.model_id { resolved_config.model_id = m.clone(); }

        let provider_name = resolved_config.provider.to_lowercase();

        // Workspace Anchoring: Map clusterId to a physical path in ./workspaces
        let workspace_id = payload.cluster_id.as_deref()
            .unwrap_or("executive-core"); // Default fallback
        
        let mut workspace_root = std::path::PathBuf::from("workspaces");
        // Sanitize the workspace ID to prevent any weird path escapes
        let sanitized_id = workspace_id.replace("..", "").replace("/", "").replace("\\", "");
        workspace_root.push(sanitized_id);

        let mut skills = a.skills.clone();
        let mut workflows = a.workflows.clone();

        let safe_mode = payload.safe_mode.unwrap_or(false);
        if safe_mode {
            // Strip mutation/execution tools
            let blacklisted_skills = ["issue_alpha_directive", "spawn_subagent", "execute_bash", "write_file", "delete_file", "append_file", "deploy"];
            skills.retain(|s| !blacklisted_skills.contains(&s.as_str()));
            workflows.clear();
        }

        Ok(RunContext {
            agent_id: agent_id.to_string(),
            name: a.name.clone(),
            role: a.role.clone(),
            department: a.department.clone(),
            description: a.description.clone(),
            model_config: resolved_config,
            skills,
            workflows,
            mission_id: mission_id.to_string(),
            depth,
            lineage: lineage.to_vec(),
            provider_name,
            workspace_root,
            safe_mode,
        })
    }

    // ─────────────────────────────────────────────────────────
    //  SYSTEM PROMPT CONSTRUCTION
    // ─────────────────────────────────────────────────────────

    async fn build_system_prompt(&self, ctx: &RunContext, hierarchy_label: &str) -> String {
        let swarm_context = crate::agent::mission::get_mission_context(&self.state.pool, &ctx.mission_id).await
            .unwrap_or_default();

        let identity = tokio::fs::read_to_string("data/context/IDENTITY.md").await.unwrap_or_else(|_| "".to_string());
        let memory = tokio::fs::read_to_string("data/memory/LONG_TERM_MEMORY.md").await.unwrap_or_else(|_| "".to_string());

        let lineage_display = if ctx.lineage.is_empty() { "None (You are the root node)".to_string() } else { ctx.lineage.join(" -> ") };

        let mut forbidden = ctx.lineage.clone();
        forbidden.push(ctx.agent_id.clone());

        let safe_mode_suffix = if ctx.safe_mode {
            "\n\n[BRAINSTORM SAFE MODE ACTIVE]\n\
             You are currently in Safe/Brainstorm Mode for a high-level strategic discussion with the Overlord. ALL execution tools and workflows (such as bash, writing files, and spawning sub-agents) have been DISABLED for safety. Discuss ideas, explore concepts, and generate plans. Do not attempt to execute actions; only strategize."
        } else {
            ""
        };

        format!(
            "You are {} (ID: {}, Role: {}) at the {} level of the swarm hierarchy.\n\
             Department: {}\n\
             Description: {}\n\n\
             SWARM MISSION CONTEXT (Shared Findings):\n\
             {}\n\n\
             RECRUITMENT LINEAGE (Mission Path):\n\
             {}\n\n\
             SKILLS: {:?}\n\
             WORKFLOWS: {:?}\n\n\
             SWARM PROTOCOL:\n\
             1. RECURSION LIMIT: You are prohibited from recruiting YOURSELF or any agent already in your LINEAGE. Do not spawn any of these IDs: {:?}.\n\
             2. REDUNDANCY: Always check if the mission context or lineage already contains the information you need before spawning a sub-agent. Prefer lateral collaboration over deep hierarchy.\n\
             3. HIERARCHY: You report to higher nodes. Your autonomy is bound by Oversight & Compliance.\n\
             4. DEEP ANALYSIS (ALETHEIA): If 'Deep Analysis' is in your workflows, you MUST follow the Generator->Verifier->Reviser-> loop. Identify your own flaws before final delivery.

             --- GLOBAL OS IDENTITY ---
             {}

             --- LONG-TERM SWARM MEMORY ---
             {}{safe_mode_suffix}",
            ctx.name, ctx.agent_id, ctx.role, hierarchy_label, ctx.department, ctx.description,
            if swarm_context.is_empty() { "No shared findings yet." } else { &swarm_context },
            lineage_display,
            ctx.skills, ctx.workflows,
            forbidden,
            identity,
            memory
        )
    }

    // ─────────────────────────────────────────────────────────
    //  TOOL DEFINITIONS
    // ─────────────────────────────────────────────────────────

    /// Builds the tool definitions based on the agent's enabled skills.
    /// PERF-06: Caches built tool definitions to avoid redundant JSON schema generation.
    fn build_tools(&self, ctx: &RunContext) -> crate::agent::gemini::GeminiTool {
        use once_cell::sync::Lazy;
        use dashmap::DashMap;

        // Static cache for tool definitions, keyed by a combined hash of skills and safe_mode
        static TOOL_CACHE: Lazy<DashMap<String, crate::agent::gemini::GeminiTool>> = Lazy::new(|| DashMap::new());

        // Create a unique key for the current combination of skills and safety settings
        let mut sorted_skills = ctx.skills.clone();
        sorted_skills.sort();
        let cache_key = format!("{}:{}", sorted_skills.join(","), ctx.safe_mode);

        if let Some(cached) = TOOL_CACHE.get(&cache_key) {
            return cached.value().clone();
        }

        let mut function_declarations = Vec::new();

        // Always include Swarm Core tools unless in safe mode
        if !ctx.safe_mode {
            function_declarations.push(crate::agent::gemini::GeminiFunctionDeclaration {
                name: "spawn_subagent".to_string(),
                description: "Spawns a specialized sub-agent to handle a specific sub-task in parallel. Use this for research, coding, or auditing while you orchestrate.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "agentId": { "type": "string", "description": "The ID of the specialist agent to recruit." },
                        "message": { "type": "string", "description": "The specific instruction or question for the sub-agent." }
                    },
                    "required": ["agentId", "message"]
                }),
            });
        }

        function_declarations.push(crate::agent::gemini::GeminiFunctionDeclaration {
            name: "share_finding".to_string(),
            description: "Shares a key finding, insight, or data point with the rest of the swarm.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "topic": { "type": "string", "description": "Short label (e.g., 'API Endpoint')." },
                    "finding": { "type": "string", "description": "The detailed finding." }
                },
                "required": ["topic", "finding"]
            }),
        });

        function_declarations.push(crate::agent::gemini::GeminiFunctionDeclaration {
            name: "complete_mission".to_string(),
            description: "Signals that the mission objective has been achieved. Provide a final comprehensive report. REQUIRES OVERSIGHT.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "finalReport": { "type": "string", "description": "Detailed summary of all work done and final results." }
                },
                "required": ["finalReport"]
            }),
        });

        function_declarations.push(crate::agent::gemini::GeminiFunctionDeclaration {
            name: "propose_capability".to_string(),
            description: "Proposes a new skill or workflow for the system. Use this to expand the swarm's abilities based on user intent. REQUIRES OVERSIGHT.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "type": { "type": "string", "enum": ["skill", "workflow"], "description": "Whether this is a 'skill' (active tool) or 'workflow' (passive instruction)." },
                    "name": { "type": "string", "description": "The unique name of the capability (lowercase, snake_case)." },
                    "description": { "type": "string", "description": "LLM-facing description of what this does." },
                    "executionCommand": { "type": "string", "description": "For skills: The shell command to run (e.g., 'python scripts/tool.py')." },
                    "schema": { "type": "object", "description": "For skills: JSON schema defining input parameters." },
                    "content": { "type": "string", "description": "For workflows: The Markdown content of the procedure." }
                },
                "required": ["type", "name", "description"]
            }),
        });

        // Dynamic Skills: All skills are now resolving natively from the capabilities registry.
        for skill in &ctx.skills {
            if let Some(dynamic_skill) = self.state.capabilities.skills.get(skill) {
                function_declarations.push(crate::agent::gemini::GeminiFunctionDeclaration {
                    name: dynamic_skill.name.clone(),
                    description: dynamic_skill.description.clone(),
                    parameters: dynamic_skill.schema.clone(),
                });
            } else {
                tracing::warn!("⚠️ Agent requests skill '{}', but it was not found in the Capabilities Registry.", skill);
            }
        }


        let tools = crate::agent::gemini::GeminiTool { function_declarations };
        TOOL_CACHE.insert(cache_key, tools.clone());
        tools
    }

    // ─────────────────────────────────────────────────────────
    //  PROVIDER DISPATCH
    // ─────────────────────────────────────────────────────────
    
    /// Accumulates token usage from a tool call into the mission total.
    fn accumulate_usage(&self, total: &mut Option<TokenUsage>, local: Option<TokenUsage>) {
        if let Some(loc) = local {
            if let Some(tot) = total {
                tot.input_tokens += loc.input_tokens;
                tot.output_tokens += loc.output_tokens;
                tot.total_tokens += loc.total_tokens;
            } else {
                *total = Some(loc);
            }
        }
    }

    /// Routes the generation request to the correct LLM provider using the shared HTTP client.
    /// Enforces RPM/TPM rate limits when configured on the model.
    async fn call_provider(
        &self,
        ctx: &RunContext,
        system_prompt: &str,
        user_message: &str,
        tools: Option<Vec<crate::agent::gemini::GeminiTool>>,
    ) -> anyhow::Result<(String, Vec<crate::agent::types::GeminiFunctionCall>, Option<crate::agent::types::TokenUsage>)> {
        let client = (*self.state.http_client).clone();

        // PERF-05 FIX: Enforce RPM and TPM limits from model configuration.
        // Blocks the current task if we're over-quota; does not block other agents.
        let limiter = crate::agent::rate_limiter::RateLimiter::new(
            ctx.model_config.rpm,
            ctx.model_config.tpm,
        );
        if limiter.is_active() {
            // Estimate ~512 tokens for the request; we'll record actuals after.
            let estimated_tokens = 512u32;
            limiter.acquire(estimated_tokens).await;
        }

        let result = match ctx.provider_name.as_str() {
            "google" | "gemini" => {
                tracing::info!("📡 [Runner] Calling Gemini API for agent {}...", ctx.agent_id);
                let api_key = ctx.model_config.api_key.clone()
                    .or_else(|| std::env::var("GOOGLE_API_KEY").ok())
                    .ok_or_else(|| anyhow::anyhow!("Missing GOOGLE_API_KEY"))?;
                let provider = crate::agent::gemini::GeminiProvider::new(client, api_key, ctx.model_config.clone());
                provider.generate(
                    &format!("{}\n\nUSER MESSAGE:\n{}", system_prompt, user_message),
                    tools
                ).await
            }
            "groq" => {
                tracing::info!("📡 [Runner] Calling Groq API for agent {}...", ctx.agent_id);
                let api_key = ctx.model_config.api_key.clone()
                    .or_else(|| std::env::var("GROQ_API_KEY").ok())
                    .ok_or_else(|| anyhow::anyhow!("Missing GROQ_API_KEY"))?;
                let provider = crate::agent::groq::GroqProvider::new(client, api_key, ctx.model_config.clone());
                provider.generate(system_prompt, user_message, tools).await
            }
            _ => {
                let err = format!("❌ Unsupported provider: {}", ctx.provider_name);
                tracing::error!("{}", err);
                self.broadcast_agent_status(&ctx.agent_id, "idle");
                Err(anyhow::anyhow!(err))
            }
        };

        // Record actual token usage against the limiter window
        if limiter.is_active() {
            if let Ok((_, _, Some(ref usage))) = &result {
                limiter.record_usage(usage.total_tokens);
            }
        }

        result
    }

    /// Calls the provider for a synthesis/follow-up step (no tool definitions).
    async fn call_provider_for_synthesis(
        &self,
        ctx: &RunContext,
        prompt: &str,
    ) -> anyhow::Result<(String, Vec<crate::agent::types::GeminiFunctionCall>, Option<crate::agent::types::TokenUsage>)> {
        let client = (*self.state.http_client).clone();

        // PERF-05: Enforce rate limits on synthesis calls too — same path as call_provider.
        let limiter = crate::agent::rate_limiter::RateLimiter::new(
            ctx.model_config.rpm,
            ctx.model_config.tpm,
        );
        if limiter.is_active() {
            limiter.acquire(256).await;
        }

        let result = match ctx.provider_name.as_str() {
            "google" | "gemini" => {
                let api_key = ctx.model_config.api_key.clone()
                    .or_else(|| std::env::var("GOOGLE_API_KEY").ok())
                    .ok_or_else(|| anyhow::anyhow!("Missing GOOGLE_API_KEY"))?;
                let provider = crate::agent::gemini::GeminiProvider::new(client, api_key, ctx.model_config.clone());
                let synthesis_prompt = format!("{}\n\nCRITICAL INSTRUCTION: You MUST provide a clear, textual, conversational response to this synthesis request. Do NOT output a blank response.", prompt);
                let (txt, fcs, use_stat) = provider.generate(&synthesis_prompt, None).await?;
                Ok((txt, fcs, use_stat))
            }
            "groq" => {
                let api_key = ctx.model_config.api_key.clone()
                    .or_else(|| std::env::var("GROQ_API_KEY").ok())
                    .ok_or_else(|| anyhow::anyhow!("Missing GROQ_API_KEY"))?;
                let provider = crate::agent::groq::GroqProvider::new(client, api_key, ctx.model_config.clone());
                let synthesis_prompt = format!("{}\n\nCRITICAL INSTRUCTION: You MUST provide a clear, textual, conversational response to this synthesis request. Do NOT output a blank response.", prompt);
                let (txt, fcs, use_stat) = provider.generate("", &synthesis_prompt, None).await?;
                Ok((txt, fcs, use_stat))
            }
            _ => Ok((prompt.to_string(), Vec::new(), None)),
        };

        // Record actual usage against the limiter window
        if limiter.is_active() {
            if let Ok((_, _, Some(ref usage))) = &result {
                limiter.record_usage(usage.total_tokens);
            }
        }

        result
    }


    // ─────────────────────────────────────────────────────────
    //  ERROR HANDLING
    // ─────────────────────────────────────────────────────────

    /// Handles provider-level errors: resets agent state, fails the mission, logs.
    async fn handle_provider_error(&self, ctx: &RunContext, e: &anyhow::Error) -> anyhow::Result<()> {
        tracing::error!("❌ [Runner] Provider error for agent {}: {}", ctx.agent_id, e);
        self.broadcast_agent_message(&ctx.agent_id, &format!("❌ Error: {}", e));
        self.broadcast_agent_status(&ctx.agent_id, "idle");
        
        if let Some(mut entry) = self.state.agents.get_mut(&ctx.agent_id) {
            entry.value_mut().status = "idle".to_string();
        }
        
        crate::agent::mission::update_mission(&self.state.pool, &ctx.mission_id, crate::agent::types::MissionStatus::Failed, 0.0).await?;
        crate::agent::mission::log_step(
            &self.state.pool,
            &ctx.mission_id,
            &ctx.agent_id,
            "System",
            &format!("❌ Error: {}", e),
            "error",
            None
        ).await?;

        Ok(())
    }

    // ─────────────────────────────────────────────────────────
    //  BUDGET ENFORCEMENT
    // ─────────────────────────────────────────────────────────

    /// Checks if the mission has exceeded its budget. Returns early-exit message if breached.
    async fn check_budget(&self, ctx: &RunContext, _step_cost: f64, output_text: &str) -> anyhow::Result<Option<String>> {
        if let Some(mission) = crate::agent::mission::get_mission_by_id(&self.state.pool, &ctx.mission_id).await? {
            if mission.cost_usd >= mission.budget_usd {
                tracing::warn!("⚠️ [Protocol] Budget limit reached for Mission {}. Automatic shutdown initiated.", ctx.mission_id);
                
                self.state.broadcast_sys(&format!("⚠️ PROTOCOL ALERT: Mission {} exceeded budget (${:.4}). Swarm auto-paused.", mission.title, mission.budget_usd), "warning");
                
                crate::agent::mission::update_mission(&self.state.pool, &ctx.mission_id, crate::agent::types::MissionStatus::Paused, 0.0).await?;
                crate::agent::mission::log_step(
                    &self.state.pool,
                    &ctx.mission_id,
                    &ctx.agent_id,
                    "Finance Analyst",
                    &format!("Emergency Pause: Neural cost (${:.4}) has exceeded allocated budget (${:.4}).", mission.cost_usd, mission.budget_usd),
                    "warning",
                    None
                ).await?;

                self.broadcast_agent_status(&ctx.agent_id, "idle");
                return Ok(Some(format!("(PAUSED: Budget Exceeded) {}", output_text)));
            }
        }
        Ok(None)
    }

    // ─────────────────────────────────────────────────────────
    //  TOOL EXECUTION (The "Intelligence" Layer)
    // ─────────────────────────────────────────────────────────

    /// Dispatches a function call to the appropriate tool handler.
    async fn execute_tool(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
        _user_message: &str,
    ) -> anyhow::Result<Option<String>> {
        let hook_ctx = HookContext {
            agent_id: ctx.agent_id.clone(),
            mission_id: Some(ctx.mission_id.clone()),
            skill: fc.name.clone(),
        };

        // 🛡️ [Guardrail] Pre-tool Lifecycle Hook
        self.state.hooks.trigger_hook("pre-tool", &hook_ctx, &fc.args).await?;

        let result: anyhow::Result<Option<String>> = match fc.name.as_str() {
            "spawn_subagent" => {
                self.handle_spawn_subagent(ctx, fc, output_text, usage).await?;
                Ok(None)
            }
            "issue_alpha_directive" => {
                let result = self.handle_alpha_directive(ctx, fc).await?;
                Ok(Some(result))
            }
            "share_finding" => {
                self.handle_share_finding(ctx, fc, output_text).await?;
                Ok(None)
            }
            "query_financial_logs" => {
                self.handle_query_financial_logs(ctx, fc, output_text, usage).await?;
                Ok(None)
            }
            "archive_to_vault" => {
                self.handle_archive_to_vault(ctx, fc, output_text).await?;
                Ok(None)
            }
            "notify_discord" => {
                self.handle_notify_discord(ctx, fc, output_text).await?;
                Ok(None)
            }
            "complete_mission" => {
                self.handle_complete_mission(ctx, fc, output_text).await?;
                Ok(None)
            }
            "fetch_url" => {
                self.handle_fetch_url(ctx, fc, output_text, usage).await?;
                Ok(None)
            }
            "read_file" => {
                self.handle_read_file(ctx, fc, output_text, usage).await?;
                Ok(None)
            }
            "write_file" => {
                self.handle_write_file(ctx, fc, output_text).await?;
                Ok(None)
            }
            "list_files" => {
                self.handle_list_files(ctx, fc, output_text, usage).await?;
                Ok(None)
            }
            "delete_file" => {
                self.handle_delete_file(ctx, fc, output_text).await?;
                Ok(None)
            }
            "propose_capability" => {
                self.handle_propose_capability(ctx, fc, output_text).await?;
                Ok(None)
            }
            _ => {
                // Check Dynamic Registry
                if let Some(dynamic_skill) = self.state.capabilities.skills.get(&fc.name) {
                    self.handle_dynamic_skill(ctx, fc, output_text, &dynamic_skill, usage).await?;
                    Ok(None)
                } else {
                    Ok(None)
                }
            },
        };

        // 📝 [Audit] Post-tool Lifecycle Hook
        self.state.hooks.trigger_hook("post-tool", &hook_ctx, &fc.args).await?;

        Ok(result?)
    }

    /// Handles execution of dynamic file-based skills via subprocess.
    async fn handle_dynamic_skill(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        skill: &crate::agent::capabilities::SkillDefinition,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let args_json = serde_json::to_string(&fc.args).unwrap_or_else(|_| "{}".to_string());
        tracing::info!("⚙️ [Dynamic Skill] Agent {} executing {} with args {}", ctx.agent_id, skill.name, args_json);
        self.state.broadcast_sys(&format!("⚙️ Skill Exec: {} is running {}", ctx.name, skill.name), "info");

        // Simple parsing: if execution_command is "python script.py", we split it.
        // We pass the args as an environment variable to prevent shell injection.
        let mut parts = skill.execution_command.split_whitespace();
        let program = parts.next().unwrap_or("");
        
        if program.is_empty() {
             *output_text = format!("(SKILL EXEC FAILED: Empty execution command) {}", output_text);
             return Ok(());
        }

        let mut cmd = tokio::process::Command::new(program);
        for arg in parts {
            cmd.arg(arg);
        }
        
        // Pass arguments via env var to prevent direct command injection into arguments
        cmd.env("TADPOLE_SKILL_ARGS", &args_json);
        // Optional: Run in the workspace directory
        cmd.current_dir(&ctx.workspace_root);

        let output_res = timeout(Duration::from_secs(60), cmd.output()).await;

        match output_res {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                
                let mut combined = stdout;
                if !stderr.is_empty() {
                    combined.push_str("\n(STDERR): ");
                    combined.push_str(&stderr);
                }

                let truncated = if combined.len() > 5000 { format!("{}... [TRUNCATED]", &combined[..5000]) } else { combined };
                
                let syntax_result = if output.status.success() {
                    format!("({} EXECUTED SUCCESSFULLY):\n\n{}\n\n{}", skill.name, truncated, output_text)
                } else {
                    format!("({} EXECUTED WITH NON-ZERO STATUS {}):\n\n{}\n\n{}", skill.name, output.status, truncated, output_text)
                };
                
                let synthesis_prompt = format!(
                    "You executed the dynamic skill '{}'. Here is the terminal output:\n\n{}\n\nPlease address the user's initial request based on this result.",
                    skill.name, syntax_result
                );
                let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &synthesis_prompt).await?;
                *output_text = final_text;
                self.accumulate_usage(usage, final_usage);
            }
            Ok(Err(e)) => {
                *output_text = format!("(SKILL EXEC FAILED to start subprocess: {}) {}", e, output_text);
            }
            Err(_) => {
                *output_text = format!("(SKILL EXEC TIMEOUT: Process took longer than 60 seconds and was terminated) {}", output_text);
                tracing::warn!("⚠️ [Protocol] Skill {} for agent {} exceeded 60s timeout and was killed.", skill.name, ctx.agent_id);
            }
        }

        Ok(())
    }

    // ─────────────────────────────────────────────────────────
    //  TOOL HANDLERS
    // ─────────────────────────────────────────────────────────

    /// Handles the `spawn_subagent` tool call: ensures sub-agent exists, recurses, synthesizes.
    async fn handle_spawn_subagent(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let sub_agent_id = fc.args.get("agentId").and_then(|v| v.as_str()).unwrap_or("general");
        let sub_message = fc.args.get("message").and_then(|v| v.as_str()).unwrap_or("");

        tracing::info!("🐝 [Swarm] Agent {} spawning sub-agent {}...", ctx.agent_id, sub_agent_id);
        self.state.broadcast_sys(&format!("🐝 Swarm: {} is recruiting {}...", ctx.name, sub_agent_id), "info");

        // Ensure sub-agent exists in persistence
        self.ensure_sub_agent_exists(sub_agent_id, &ctx.model_config).await?;

        // Recursive call with updated lineage
        let mut updated_lineage = ctx.lineage.clone();
        updated_lineage.push(ctx.agent_id.clone());

        // Neural Handoff: Inject parent's current strategic intent/thoughts into sub-message
        let strategic_intent = if !output_text.is_empty() {
            format!("\n\n--- PARENT STRATEGIC INTENT ---\n{}\n--- END INTENT ---", output_text)
        } else {
            "".to_string()
        };

        let sub_result = Box::pin(self.run(sub_agent_id.to_string(), TaskPayload {
            message: format!("{}{}", sub_message, strategic_intent),
            cluster_id: Some(ctx.mission_id.clone()),
            department: None,
            provider: Some(ctx.model_config.provider.clone()),
            model_id: Some(ctx.model_config.model_id.clone()),
            api_key: ctx.model_config.api_key.clone(),
            base_url: ctx.model_config.base_url.clone(),
            rpm: None,
            tpm: None,
            budget_usd: None,
            swarm_depth: Some(ctx.depth + 1),
            swarm_lineage: Some(updated_lineage),
            external_id: ctx.model_config.external_id.clone(),
            safe_mode: Some(ctx.safe_mode),
        })).await?;

        // Feed sub-result back for synthesis
        let synthesis_prompt = format!(
            "Sub-agent {} reported back with this result:\n\n{}\n\nPlease synthesize this and provide your final response.",
            sub_agent_id, sub_result
        );

        let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &synthesis_prompt).await?;

        *output_text = final_text;
        self.accumulate_usage(usage, final_usage);

        Ok(())
    }

    /// Ensures a sub-agent exists in the state and database.
    async fn ensure_sub_agent_exists(&self, sub_agent_id: &str, parent_config: &ModelConfig) -> anyhow::Result<()> {
        if self.state.agents.contains_key(sub_agent_id) {
            return Ok(());
        }

        tracing::info!("🛠️ [Swarm] Registering missing sub-agent: {}", sub_agent_id);
        let sub_agent = crate::agent::registry::get_mock_registry().into_iter()
            .find(|a| a.id == sub_agent_id)
            .unwrap_or_else(|| {
                crate::agent::types::EngineAgent {
                    id: sub_agent_id.to_string(),
                    name: sub_agent_id.to_string(),
                    role: "General Intelligence Node".to_string(),
                    department: "Swarm Core".to_string(),
                    description: "Autonomous sub-agent spawned for specific task resolution.".to_string(),
                    model_id: Some(parent_config.model_id.clone()),
                    tokens_used: 0,
                    status: "idle".to_string(),
                    theme_color: Some("#4fd1c5".to_string()),
                    budget_usd: 10.0,
                    cost_usd: 0.0,
                    metadata: std::collections::HashMap::new(),
                    skills: vec!["fetch_url".to_string()],
                    workflows: vec![],
                    model_2: None,
                    model_3: None,
                    model_config2: None,
                    model_config3: None,
                    active_model_slot: None,
                    token_usage: TokenUsage::default(),
                    model: crate::agent::types::ModelConfig {
                        provider: parent_config.provider.clone(),
                        model_id: parent_config.model_id.clone(),
                        api_key: None,
                        base_url: parent_config.base_url.clone(),
                        system_prompt: None,
                        temperature: None,
                        max_tokens: None,
                        external_id: None,
                        rpm: parent_config.rpm,
                        rpd: parent_config.rpd,
                        tpm: parent_config.tpm,
                        tpd: parent_config.tpd,
                    },
                    active_mission: None,
                }
            });
        
        crate::agent::persistence::save_agent_db(&self.state.pool, &sub_agent).await?;
        self.state.agents.insert(sub_agent_id.to_string(), sub_agent);

        Ok(())
    }

    /// Handles `issue_alpha_directive`: delegates to Tadpole Alpha (ID: 2).
    async fn handle_alpha_directive(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
    ) -> anyhow::Result<String> {
        let directive = fc.args.get("directive").and_then(|v| v.as_str()).unwrap_or("");
        
        tracing::info!("🧬 [Sovereignty] Agent of Nine issuing directive to Tadpole Alpha...");
        self.state.broadcast_sys("🧬 Agent of Nine: Handing off to Tadpole Alpha...", "info");

        let mut updated_lineage = ctx.lineage.clone();
        updated_lineage.push(ctx.agent_id.clone());

        let sub_result = Box::pin(self.run("2".to_string(), TaskPayload {
            message: directive.to_string(),
            cluster_id: Some(ctx.mission_id.clone()),
            department: None,
            provider: None,
            model_id: None,
            api_key: None,
            base_url: None,
            rpm: None,
            tpm: None,
            budget_usd: None,
            swarm_depth: Some(ctx.depth + 1),
            swarm_lineage: Some(updated_lineage),
            external_id: None,
            safe_mode: Some(ctx.safe_mode),
        })).await?;

        Ok(format!("Directive issued to Tadpole Alpha. Mission ID: {}\n\nResult: {}", ctx.mission_id, sub_result))
    }

    /// Handles `share_finding`: persists a finding to the swarm context.
    async fn handle_share_finding(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let topic = fc.args.get("topic").and_then(|v| v.as_str()).unwrap_or("General");
        let finding = fc.args.get("finding").and_then(|v| v.as_str()).unwrap_or("");

        tracing::info!("📢 [Swarm] Agent {} shared a finding on {}: {}", ctx.agent_id, topic, finding);
        self.state.broadcast_sys(&format!("📢 Swarm: {} added context for {}", ctx.name, topic), "success");

        crate::agent::mission::share_finding(&self.state.pool, &ctx.mission_id, &ctx.agent_id, topic, finding).await?;

        *output_text = format!("(Shared finding on {} to swarm context) {}", topic, output_text);
        Ok(())
    }

    /// Handles `query_financial_logs`: retrieves and analyzes mission cost history.
    async fn handle_query_financial_logs(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let limit = fc.args.get("limit").and_then(|v| v.as_i64()).unwrap_or(10);
        
        tracing::info!("📊 [Governance] Agent {} querying financial history (limit: {})...", ctx.agent_id, limit);
        self.state.broadcast_sys(&format!("📊 Audit: {} is reviewing fiscal logs...", ctx.name), "info");

        let history = crate::agent::mission::get_recent_missions(&self.state.pool, limit).await?;
        let history_json = serde_json::to_string_pretty(&history).unwrap_or_default();

        let audit_prompt = format!(
            "MISSION HISTORY RETRIEVED:\n\n{}\n\nPlease analyze this history for cost anomalies, burn rates, or optimization opportunities.",
            history_json
        );

        let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &audit_prompt).await?;

        *output_text = final_text;
        self.accumulate_usage(usage, final_usage);

        Ok(())
    }

    /// Handles `archive_to_vault`: writes data to the local Markdown vault after oversight.
    async fn handle_archive_to_vault(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let filename = fc.args.get("filename").and_then(|v| v.as_str()).unwrap_or("unnamed.md");
        let content = fc.args.get("content").and_then(|v| v.as_str()).unwrap_or("");

        tracing::info!("📁 [Surface] Agent {} archiving to vault (Waiting for Oversight)...", ctx.agent_id);
        self.state.broadcast_sys(&format!("📁 Oversight: {} wants to archive to vault. Review required.", ctx.name), "warning");

        let approved = self.submit_oversight(crate::agent::types::ToolCall {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: ctx.agent_id.clone(),
            mission_id: Some(ctx.mission_id.clone()),
            skill: "archive_to_vault".to_string(),
            params: fc.args.clone(),
            department: ctx.department.clone(),
            description: "Archiving data to the central vault for persistence.".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }, Some(ctx.mission_id.clone())).await;

        if approved {
            let adapter = crate::adapter::vault::VaultAdapter::new(std::path::PathBuf::from("vault"));
            adapter.append_to_file(filename, content).await?;
            *output_text = format!("(Archived to vault: {}) {}", filename, output_text);
        } else {
            *output_text = format!("(Archive REJECTED by Oversight) {}", output_text);
        }

        Ok(())
    }

    /// Handles `notify_discord`: sends a webhook notification after oversight.
    async fn handle_notify_discord(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let msg = fc.args.get("message").and_then(|v| v.as_str()).unwrap_or("");

        tracing::info!("🔔 [Surface] Agent {} requesting Discord notification...", ctx.agent_id);
        self.state.broadcast_sys(&format!("🔔 Oversight: {} wants to notify Discord.", ctx.name), "warning");

        let approved = self.submit_oversight(crate::agent::types::ToolCall {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: ctx.agent_id.clone(),
            mission_id: Some(ctx.mission_id.clone()),
            skill: "notify_discord".to_string(),
            params: fc.args.clone(),
            department: ctx.department.clone(),
            description: "Sending an external notification via Discord.".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }, Some(ctx.mission_id.clone())).await;

        if approved {
            if let Ok(webhook) = std::env::var("DISCORD_WEBHOOK") {
                let adapter = crate::adapter::discord::DiscordAdapter::new(webhook);
                adapter.notify(&ctx.name, msg).await?;
                self.state.broadcast_sys(&format!("🔔 Surface: {} sent Discord alert", ctx.name), "success");
                *output_text = format!("(Notified Discord) {}", output_text);
            } else {
                *output_text = format!("(Discord notification failed - no webhook) {}", output_text);
            }
        } else {
            *output_text = format!("(Discord notification REJECTED by Oversight) {}", output_text);
        }

        Ok(())
    }

    /// Handles `complete_mission`: marks the mission as completed after oversight.
    async fn handle_complete_mission(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let report = fc.args.get("finalReport").and_then(|v| v.as_str()).unwrap_or("Mission complete.");
        
        tracing::info!("🏁 [Mission] Agent {} requesting completion...", ctx.agent_id);
        self.state.broadcast_sys(&format!("🏁 Oversight: {} finished work. Reviewing final report...", ctx.name), "warning");

        let approved = self.submit_oversight(crate::agent::types::ToolCall {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: ctx.agent_id.clone(),
            mission_id: Some(ctx.mission_id.clone()),
            skill: "complete_mission".to_string(),
            params: fc.args.clone(),
            department: ctx.department.clone(),
            description: "Final mission sign-off and reporting.".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }, Some(ctx.mission_id.clone())).await;

        if approved {
            crate::agent::mission::update_mission(&self.state.pool, &ctx.mission_id, crate::agent::types::MissionStatus::Completed, 0.0).await?;
            self.state.broadcast_sys(&format!("✅ Mission {} COMPLETED.", ctx.mission_id), "success");
            *output_text = format!("(MISSION COMPLETED: {}) {}", report, output_text);
        } else {
            *output_text = format!("(Mission completion REJECTED) {}", output_text);
        }

        Ok(())
    }

    /// Handles `fetch_url`: retrieves text content from a public URL.
    async fn handle_fetch_url(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let url = fc.args.get("url").and_then(|v| v.as_str()).unwrap_or("");
        tracing::info!("🌐 [Surface] Agent {} fetching URL: {}", ctx.agent_id, url);
        self.state.broadcast_sys(&format!("🌐 Surface: {} is researching {}...", ctx.name, url), "info");

        match reqwest::get(url).await {
            Ok(r) => {
                let text = r.text().await.unwrap_or_else(|_| "Error reading text".to_string());
                let truncated = if text.len() > 3000 { format!("{}... [TRUNCATED]", &text[..3000]) } else { text };
                let fetch_res = format!("(FETCHED CONTENT): {}\n\n{}", truncated, output_text);
                
                let synthesis_prompt = format!(
                    "You fetched the URL '{}'. Here is the content:\n\n{}\n\nPlease address the user's initial request using this information.",
                    url, fetch_res
                );
                let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &synthesis_prompt).await?;
                *output_text = final_text;
                self.accumulate_usage(usage, final_usage);
            }
            Err(e) => {
                *output_text = format!("(FETCH FAILED: {}) {}", e, output_text);
            }
        }

        Ok(())
    }

    /// Handles `read_file`: reads content from the workspace.
    async fn handle_read_file(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let filename = fc.args.get("filename").and_then(|v| v.as_str()).unwrap_or("");
        tracing::info!("📖 [Workspace] Agent {} reading file: {}", ctx.agent_id, filename);
        
        let adapter = crate::adapter::filesystem::FilesystemAdapter::new(ctx.workspace_root.clone());
        match adapter.read_file(filename).await {
            Ok(content) => {
                let truncated = if content.len() > 5000 { format!("{}... [TRUNCATED]", &content[..5000]) } else { content };
                let read_res = format!("(FILE CONTENT OF {}):\n\n{}\n\n{}", filename, truncated, output_text);
                
                let synthesis_prompt = format!(
                    "You read the file '{}'. Here is the content:\n\n{}\n\nPlease address the user's initial request based on this.",
                    filename, read_res
                );
                let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &synthesis_prompt).await?;
                *output_text = final_text;
                self.accumulate_usage(usage, final_usage);
            }
            Err(e) => {
                *output_text = format!("(READ FAILED: {}) {}", e, output_text);
            }
        }
        Ok(())
    }

    /// Handles `write_file`: writes content to the workspace.
    async fn handle_write_file(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let filename = fc.args.get("filename").and_then(|v| v.as_str()).unwrap_or("");
        let content = fc.args.get("content").and_then(|v| v.as_str()).unwrap_or("");
        
        tracing::info!("✍️ [Workspace] Agent {} writing to file: {}", ctx.agent_id, filename);
        
        let adapter = crate::adapter::filesystem::FilesystemAdapter::new(ctx.workspace_root.clone());
        match adapter.write_file(filename, content).await {
            Ok(_) => {
                self.state.broadcast_sys(&format!("✍️ Workspace: {} wrote to {}", ctx.name, filename), "success");
                *output_text = format!("(Successfully wrote to {}) {}", filename, output_text);
            }
            Err(e) => {
                *output_text = format!("(WRITE FAILED: {}) {}", e, output_text);
            }
        }
        Ok(())
    }

    /// Handles `list_files`: lists directory contents in the workspace.
    async fn handle_list_files(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
        usage: &mut Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<()> {
        let dir = fc.args.get("dir").and_then(|v| v.as_str()).unwrap_or(".");
        tracing::info!("📂 [Workspace] Agent {} listing directory: {}", ctx.agent_id, dir);

        let adapter = crate::adapter::filesystem::FilesystemAdapter::new(ctx.workspace_root.clone());
        match adapter.list_files(dir).await {
            Ok(files) => {
                let list = if files.is_empty() { "Empty directory.".to_string() } else { files.join(", ") };
                let list_res = format!("(FILES IN {}): {}\n\n{}", dir, list, output_text);
                
                let synthesis_prompt = format!(
                    "You listed the directory '{}'. Here are the files:\n\n{}\n\nPlease address the user's initial request based on this.",
                    dir, list_res
                );
                let (final_text, _, final_usage) = self.call_provider_for_synthesis(ctx, &synthesis_prompt).await?;
                *output_text = final_text;
                self.accumulate_usage(usage, final_usage);
            }
            Err(e) => {
                *output_text = format!("(LIST FAILED: {}) {}", e, output_text);
            }
        }
        Ok(())
    }

    /// Handles `delete_file`: removes a file or directory after oversight.
    async fn handle_delete_file(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let filename = fc.args.get("filename").and_then(|v| v.as_str()).unwrap_or("");

        tracing::info!("🗑️ [Workspace] Agent {} requesting deletion of: {}", ctx.agent_id, filename);
        self.state.broadcast_sys(&format!("🗑️ Oversight: {} wants to DELETE {}. Extreme caution required.", ctx.name, filename), "warning");

        let approved = self.submit_oversight(crate::agent::types::ToolCall {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: ctx.agent_id.clone(),
            mission_id: Some(ctx.mission_id.clone()),
            skill: "delete_file".to_string(),
            params: fc.args.clone(),
            department: ctx.department.clone(),
            description: format!("Deleting {} from the workspace.", filename),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }, Some(ctx.mission_id.clone())).await;

        if approved {
            let adapter = crate::adapter::filesystem::FilesystemAdapter::new(ctx.workspace_root.clone());
            match adapter.delete_file(filename).await {
                Ok(_) => {
                    self.state.broadcast_sys(&format!("🗑️ Workspace: {} deleted {}", ctx.name, filename), "success");
                    *output_text = format!("(Successfully deleted {}) {}", filename, output_text);
                }
                Err(e) => {
                    *output_text = format!("(DELETE FAILED: {}) {}", e, output_text);
                }
            }
        } else {
            *output_text = format!("(Delete REJECTED by Oversight) {}", output_text);
        }

        Ok(())
    }

    /// Handles `propose_capability`: submits a new skill or workflow proposal to the Oversight Gate.
    async fn handle_propose_capability(
        &self,
        ctx: &RunContext,
        fc: &crate::agent::types::GeminiFunctionCall,
        output_text: &mut String,
    ) -> anyhow::Result<()> {
        let cap_type_str = fc.args.get("type").and_then(|v| v.as_str()).unwrap_or("skill");
        let name = fc.args.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
        
        let cap_type = if cap_type_str == "workflow" {
            crate::agent::types::CapabilityType::Workflow
        } else {
            crate::agent::types::CapabilityType::Skill
        };

        let proposal = crate::agent::types::CapabilityProposal {
            r#type: cap_type,
            name: name.to_string(),
            description: fc.args.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            execution_command: fc.args.get("executionCommand").and_then(|v| v.as_str()).map(|s| s.to_string()),
            schema: fc.args.get("schema").cloned(),
            content: fc.args.get("content").and_then(|v| v.as_str()).map(|s| s.to_string()),
        };

        tracing::info!("💡 [Sovereignty] Agent {} proposing a new capability: {} ({})", ctx.agent_id, name, cap_type_str);
        self.state.broadcast_sys(&format!("💡 Oversight: {} wants to expand our swarm with a new {}: {}. Review required.", ctx.name, cap_type_str, name), "warning");

        let approved = self.submit_capability_oversight(proposal.clone(), Some(ctx.mission_id.clone()), &ctx.agent_id, &ctx.department).await;

        if approved {
            *output_text = format!("(Successfully PROPOSED and APPROVED new {}: {}) {}", cap_type_str, name, output_text);
        } else {
            *output_text = format!("(Capability Proposal for {} REJECTED by Oversight) {}", name, output_text);
        }

        Ok(())
    }

    /// Submits a capability proposal for manual user approval.
    pub async fn submit_capability_oversight(
        &self,
        proposal: crate::agent::types::CapabilityProposal,
        mission_id: Option<String>,
        _agent_id: &str,
        _department: &str,
    ) -> bool {
        let entry_id = uuid::Uuid::new_v4().to_string();
        
        let entry = crate::agent::types::OversightEntry {
            id: entry_id.clone(),
            mission_id,
            tool_call: None,
            capability_proposal: Some(proposal),
            status: "pending".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        self.state.oversight_queue.insert(entry_id.clone(), entry.clone());
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.state.oversight_resolvers.insert(entry_id.clone(), tx);

        self.state.emit_event(serde_json::json!({
            "type": "oversight:new",
            "entry": entry
        }));

        match rx.await {
            Ok(approved) => approved,
            Err(_) => false,
        }
    }
    /// Finalizes the run: updates token usage, persists mission state, broadcasts results.
    async fn finalize_run(
        &self,
        ctx: &RunContext,
        output_text: &str,
        usage: &Option<crate::agent::types::TokenUsage>,
    ) -> anyhow::Result<String> {
        tracing::info!("✅ [Runner] Provider responded successfully ({} tokens)", usage.as_ref().map(|u| u.total_tokens).unwrap_or(0));
        
        // Update global agent state
        if let Some(mut entry) = self.state.agents.get_mut(&ctx.agent_id) {
            let agent = entry.value_mut();
            if let Some(ref u) = usage {
                agent.token_usage = u.clone(); // Use the cumulative turn usage
                agent.tokens_used += u.total_tokens;
            }
            
            // Re-calculate turn cost from final cumulative usage
            let turn_cost = crate::agent::rates::calculate_cost(
                &ctx.model_config.model_id, 
                usage.as_ref().map(|u| u.input_tokens).unwrap_or(0), 
                usage.as_ref().map(|u| u.output_tokens).unwrap_or(0)
            );
            
            agent.cost_usd += turn_cost;
            agent.status = "idle".to_string();
            
            // Sync to persistence
            let pool = self.state.pool.clone();
            let agent_clone = agent.clone();
            tokio::spawn(async move {
                let _ = crate::agent::persistence::save_agent_db(&pool, &agent_clone).await;
            });

            self.state.emit_event(serde_json::json!({
                "type": "agent:update",
                "agentId": ctx.agent_id,
                "data": *agent
            }));
        }

        // Delivery formatting
        let mut final_delivery = output_text.trim().to_string();
        if final_delivery.is_empty() {
            final_delivery = "(Agent completed its actions without a final conversational response.)".to_string();
        }

        self.broadcast_agent_message(&ctx.agent_id, &final_delivery);
        self.broadcast_agent_status(&ctx.agent_id, "idle");

        // Finalize mission persistence
        let final_cumulative_cost = crate::agent::rates::calculate_cost(
            &ctx.model_config.model_id, 
            usage.as_ref().map(|u| u.input_tokens).unwrap_or(0), 
            usage.as_ref().map(|u| u.output_tokens).unwrap_or(0)
        );
        
        crate::agent::mission::update_mission(&self.state.pool, &ctx.mission_id, crate::agent::types::MissionStatus::Completed, final_cumulative_cost).await?;
        crate::agent::mission::log_step(
            &self.state.pool,
            &ctx.mission_id,
            &ctx.agent_id,
            "Agent",
            output_text,
            "success",
            None
        ).await?;

        Ok(final_delivery)
    }

    // ─────────────────────────────────────────────────────────
    //  UTILITIES
    // ─────────────────────────────────────────────────────────

    /// Submits a tool call for manual user approval.
    /// Returns true if approved, false if rejected.
    #[allow(dead_code)]
    pub async fn submit_oversight(&self, mut tool_call: crate::agent::types::ToolCall, mission_id: Option<String>) -> bool {
        let entry_id = uuid::Uuid::new_v4().to_string();
        
        tool_call.mission_id = mission_id.clone();
        
        let entry = crate::agent::types::OversightEntry {
            id: entry_id.clone(),
            mission_id,
            tool_call: Some(tool_call),
            capability_proposal: None,
            status: "pending".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        // 1. Register in the queue
        self.state.oversight_queue.insert(entry_id.clone(), entry.clone());

        // 2. Create a channel for the decision
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.state.oversight_resolvers.insert(entry_id.clone(), tx);

        // 3. Notify the UI
        self.state.emit_event(serde_json::json!({
            "type": "oversight:new",
            "entry": entry
        }));

        // 4. Await the user's click in the dashboard
        match rx.await {
            Ok(approved) => approved,
            Err(_) => false, // Resolver dropped
        }
    }

    // --- Telemetry Helpers ---
    
    fn broadcast_agent_status(&self, agent_id: &str, status: &str) {
        self.state.emit_event(serde_json::json!({
            "type": "agent:status",
            "agentId": agent_id,
            "status": status
        }));
        
        let display_status = status.chars().next().unwrap().to_uppercase().collect::<String>() + &status[1..];
        self.state.broadcast_sys(&format!("Agent {} is now {}.", agent_id, display_status), "info");
    }

    fn broadcast_agent_message(&self, agent_id: &str, text: &str) {
        self.state.emit_event(serde_json::json!({
            "type": "agent:message",
            "agentId": agent_id,
            "text": text,
            "messageId": uuid::Uuid::new_v4().to_string()
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::types::TaskPayload;

    fn make_payload(msg: &str) -> TaskPayload {
        TaskPayload {
            message: msg.to_string(),
            cluster_id: None,
            department: None,
            provider: None,
            model_id: None,
            api_key: None,
            base_url: None,
            rpm: None,
            tpm: None,
            budget_usd: None,
            swarm_depth: None,
            swarm_lineage: None,
            external_id: None,
            safe_mode: None,
        }
    }

    #[tokio::test]
    async fn test_finalize_run_fallback_on_empty_output() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state.clone());
        
        let test_uuid = uuid::Uuid::new_v4().to_string();
        let agent_id = format!("agent-test-{}", test_uuid);
        let mission_id = format!("mission-test-{}", test_uuid);
        
        sqlx::query("INSERT INTO agents (id, name, role, department, description, status, metadata) VALUES (?, 'Test Runner', 'tester', 'QA', 'desc', 'idle', '{}')").bind(&agent_id).execute(&state.pool).await.unwrap();
        sqlx::query("INSERT INTO mission_history (id, agent_id, title, status) VALUES (?, ?, 'Test Mission', 'active')").bind(&mission_id).bind(&agent_id).execute(&state.pool).await.unwrap();
        
        let ctx = RunContext {
            agent_id: agent_id.clone(),
            name: "Test Runner".to_string(),
            role: "tester".to_string(),
            department: "QA".to_string(),
            description: "desc".to_string(),
            mission_id: mission_id.clone(),
            model_config: crate::agent::types::ModelConfig {
                provider: "mock".to_string(),
                model_id: "mock".to_string(),
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
            provider_name: "mock".to_string(),
            skills: vec![],
            workflows: vec![],
            depth: 0,
            lineage: vec![],
            workspace_root: std::path::PathBuf::from("."),
            safe_mode: false,
        };
        
        let result_empty = runner.finalize_run(&ctx, "   \n  \t ", &None).await.unwrap();
        assert_eq!(result_empty, "(Agent completed its actions without a final conversational response.)");
        
        let result_normal = runner.finalize_run(&ctx, "  Hello Context!  ", &None).await.unwrap();
        assert_eq!(result_normal, "Hello Context!");
    }

    #[tokio::test]
    async fn validate_input_accepts_normal_message() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state);
        let payload = make_payload("Hello, agent!");
        let result = runner.validate_input("agent-1", &payload);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn validate_input_rejects_oversized_message() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state);
        let long_msg = "x".repeat(40_000);
        let payload = make_payload(&long_msg);
        let result = runner.validate_input("agent-1", &payload);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too long"));
    }

    #[tokio::test]
    async fn validate_input_detects_circular_recursion() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state);
        let mut payload = make_payload("test");
        payload.swarm_lineage = Some(vec!["agent-1".to_string(), "agent-2".to_string()]);
        payload.swarm_depth = Some(2);

        let result = runner.validate_input("agent-1", &payload);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("CIRCULAR RECURSION"));
    }

    #[tokio::test]
    async fn validate_input_allows_non_circular_lineage() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state);
        let mut payload = make_payload("test");
        payload.swarm_lineage = Some(vec!["agent-1".to_string(), "agent-2".to_string()]);
        payload.swarm_depth = Some(2);

        let result = runner.validate_input("agent-3", &payload);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn validate_input_enforces_depth_limit() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state);
        let mut payload = make_payload("test");
        payload.swarm_depth = Some(5);

        let result = runner.validate_input("agent-1", &payload);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("depth limit"));
    }

    #[tokio::test]
    async fn build_system_prompt_includes_role_and_department() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state.clone());

        let ctx = RunContext {
            agent_id: "1".to_string(),
            name: "Agent of Nine".to_string(),
            role: "CEO".to_string(),
            department: "Executive".to_string(),
            description: "Supreme tactical orchestrator.".to_string(),
            mission_id: "test-mission".to_string(),
            model_config: state.agents.get("1").unwrap().model.clone(),
            provider_name: "google".to_string(),
            skills: vec![],
            workflows: vec![],
            depth: 0,
            lineage: vec![],
            workspace_root: std::path::PathBuf::from("workspaces/executive-core"),
            safe_mode: false,
        };

        let prompt = runner.build_system_prompt(&ctx, "Alpha").await;
        assert!(prompt.contains("Agent of Nine"));
        assert!(prompt.contains("Executive"));
        assert!(prompt.contains("Alpha"));
    }

    #[tokio::test]
    async fn build_system_prompt_includes_lineage_when_present() {
        let state = Arc::new(crate::state::AppState::new().await);
        let runner = AgentRunner::new(state.clone());

        let ctx = RunContext {
            agent_id: "2".to_string(),
            name: "Tadpole".to_string(),
            role: "COO".to_string(),
            department: "Operations".to_string(),
            description: "Operational coordination specialist.".to_string(),
            mission_id: "test-mission".to_string(),
            model_config: state.agents.get("2").unwrap().model.clone(),
            provider_name: "google".to_string(),
            skills: vec![],
            workflows: vec![],
            depth: 1,
            lineage: vec!["Agent of Nine".to_string()],
            workspace_root: std::path::PathBuf::from("workspaces/executive-core"),
            safe_mode: false,
        };

        let prompt = runner.build_system_prompt(&ctx, "Sub-Agent").await;
        assert!(prompt.contains("Agent of Nine"), "Should contain parent in lineage");
        assert!(prompt.contains("Tadpole"), "Should contain agent name");
        assert!(prompt.contains("Sub-Agent"), "Should contain hierarchy label");
    }
}


