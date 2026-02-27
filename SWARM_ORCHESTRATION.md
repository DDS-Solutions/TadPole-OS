# 🐝 Swarm Orchestration Guide

Moving from a single-agent chat to a **Hierarchical Swarm** is how you achieve "Top Tier" success with Tadpole OS. This guide outlines the strategies for designing robust, autonomous intelligence clusters.

## 1. The Hierarchical Command Pattern
Tadpole OS enforces a strict command hierarchy to prevent "Swarm Drift" (where agents lose track of the original objective).

1.  **CEO (Sovereign)**: The **Agent of Nine (ID 1)**. Receives strategic intent (via Voice/Neural Handoff) and issues refined directives to Alphas.
2.  **Alpha Node (Tactical)**: Coordinates the cluster. Spawns specialized sub-agents and handles synthesis.
3.  **Specialists (Execution)**: Focused on specific skills (e.g., `web_search`, `code_execute`). They report findings up to the Alpha.

## 2. The Sovereignty Handoff Pattern (Top Tier)
The most advanced orchestration strategy in Tadpole OS.

- **Objective**: Execute complex user intent with zero "micro-delegation" effort.
- **Protocol**:
    1. User speaks a high-level goal to the **Neural Sync Interface**.
    2. **Groq Whisper** transcribes it with high fidelity.
    3. **Agent of Nine (CEO)** receives the transcript, applies strategic "Best Practices," and uses the `issue_alpha_directive` tool.
    4. **Tadpole Alpha (COO)** receives a perfectly formatted tactical mission and begins swarm execution immediately.
- **Benefit**: Decouples the user from the "nitty-gritty" of cluster configuration.

## 3. Shared Wisdom: The Context Bus
Agents do not communicate secrets; they broadcast findings. To optimize your swarm:
- **Be Descriptive**: When an agent reports a finding, ensure it includes source citations.
- **Synthesis Turns**: Use the Alpha Node's "Thinking" phases to merge conflicting findings before the final report.

## 4. Parallel Swarm Execution (PERF-06)
**Tadpole OS** enables **Concurrent Tooling**.
- **The Optimization**: When an agent decides to use multiple tools (e.g., `spawn_subagent` for three different specialists), the engine executes them in parallel.
- **Impact**: Swarm startup time remains near-constant even as the number of initial specialists increases. Use this to recruit "Department Clusters" in a single turn.

## 3. Designing a "Top Tier" Mission
Follow this template for maximum reliability:

### Phase A: Discovery (Depth 0-1)
The Overlord (Entity 0) (AKA Human-in-the-loop) identifies the scope.
> "Alpha, research the impact of Quantum Computing on the current finance market."

### Phase B: Parallelization (Depth 2)
The Alpha recruits specialists.
> `spawn_subagent("researcher_a", "Analyze GPU stock trends")`
> `spawn_subagent("researcher_b", "Analyze theoretical cryptography breakthroughs")`

### Phase C: Reconciliation
The Alpha merges the researcher data on the **Silicon Horizon**.
> "Reconciling Market Data with Crypto Risks..."

### Best Practice: Strategic Handoffs
When recruitment is necessary, the engine automatically injects the parent's current "Strategic Thought" into the child agent's payload. This ensures that a researcher spawned by a CEO knows exactly *why* they are researching, improving the depth of the initial response.

## 4. Operational Guardrails
- **Cost Awareness**: Always set a `budgetUsd` for hierarchical swarms. Recursive spawning can consume tokens quickly. **Real-time USD burn and token usage** are tracked per-node on the agent card.
- **Recursion Limits**: Tadpole OS enforces a strict **Depth Limit of 5**. Missions reaching this depth will stop recruitment to prevent infinite token consumption.
- **Lineage Awareness**: The engine tracks the recruitment chain (A → B → C). Agents are strictly prohibited from recruiting anyone already in their lineage.
- **Model Inheritance**: Sub-agents automatically inherit the parent node's model identity and provider credentials.
- **Rate Limiting**: RPM and TPM limits set on a model (in the Model Registry) are **automatically enforced** by the engine. Agents will wait for quota windows to reset rather than fail. Configure limits to stay within your provider's free tier.
- **Dynamic Capabilities**: If the swarm lacks a necessary function (e.g., retrieving data from an internal API), you can write a new script in the **Skills & Workflows Manager**. Agents can be assigned this new capability immediately without a server reboot.
- **Oversight**: Enable "Submit Oversight" for the `complete_mission` tool to ensure the Overlord (Entity 0) (AKA Human-in-the-loop) reviews the swarm's final synthesis before it's archived.

## 5. Neural Swarm Optimization (Intelligent Guidance)
When defining a mission objective in the UI, the engine proactively analyzes the intent to suggest optimized configurations.

- **Proffered Optimization**: The system detects keywords (e.g., "security", "audit", "scale") and suggests specific roles, models, and skills.
- **Authorize Sync**: Applies the AI's recommended configuration to the cluster immediately.
- **Dismiss**: Ignores the suggestion, preserving your manual setup.

> [!NOTE]
> **Dynamic Scaling**: The number of clusters in your swarm is not static. You can create new Mission Clusters or retire old ones directly from the UI. These groupings are preserved in your browser's LocalStorage, ensuring your custom organizational structure persists across sessions.

## 6. Swarm Efficiency Checklist
- [ ] Does the Overlord have a high-temperature model for creative planning?
- [ ] Do specialists have precise models (low temperature) for data extraction?
- [ ] Is the `fetch_url` skill granted ONLY to the nodes that need it?
- [ ] Has the Alpha been given a system prompt emphasizing "Synthesis and Conflict Resolution"?
- [ ] Have RPM/TPM limits been set on all models to prevent provider quota overruns?
- [ ] Are file-writing agents assigned to a cluster with a dedicated workspace?
- [ ] Is `delete_file` skill omitted from agents that only need to read?

## 7. Workspace File Operations in Swarms

Agents can now read and write files within their cluster's physical workspace — enabling multi-turn collaborative document generation.

### Example: Research → Write → Summarize Pipeline
```
Specialist A: web_search → write_file("raw_research.md")
Specialist B: read_file("raw_research.md") → write_file("analysis.md")
Alpha Node:   read_file("analysis.md") → archive_to_vault("final_report.md")
```

- Files are isolated per cluster under `workspaces/<cluster-id>/`.
- All file paths are sandboxed — agents cannot escape their designated directory.
- `delete_file` always requires **Oversight Gate** approval.
