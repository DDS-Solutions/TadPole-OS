# 📖 Tadpole OS Glossary

This document defines the core concepts and terminology used within the Tadpole OS ecosystem. This glossary is designed to provide consistency for both human operators and AI assistants.

## Core Concepts

### Alpha Node
The "Leader" of a cluster mission. An Alpha Node is responsible for high-level reasoning, recruiting sub-agents, and synthesizing results. In the hierarchy, this is typically an agent assigned the `cluster-head` crown on a specific mission.

### Alpha Directive
A high-level tactical command issued by the **Agent of Nine (CEO)** using a specialized tool (`issue_alpha_directive`). It provides refined, sovereign instructions that override a cluster's default behavior for strategic alignment.

### Agent of Nine (CEO Sovereignty)
The supreme strategic orchestrator (ID 1). Unlike tactical agents (Tadpole, Elon), Nine operates at the highest level of intent refinement and is the primary recipient of "Neural Handoff" voice commands.

### Strategic Intent Injection
The **Tadpole OS** refinement layer. When an agent recruits a sub-agent, its current strategic thoughts are injected into the sub-agent's prompt. This ensures the sub-agent has immediate, high-level context without waiting for multiple context-gathering turns.

### Context Bus
The shared memory space for a swarm mission. All findings, synthesized reports, and system logs within a mission are broadcast to the Context Bus, allowing agents to "hear" each other's progress without direct peer-to-peer communication.

### Neural Sector Fault (NSF)
A failure in a specific layer of the engine (e.g., Core, Provider, or UI). NSFs are typically logged with trace details to help developers isolate the sector (Backend vs Frontend vs LLM) responsible for the error.

### Neural Handoff (Voice-to-Swarm)
The process of capturing human voice intent, transcribing it via high-fidelity engines (Groq Whisper), and delivering the strategic text to the Agent of Nine for autonomous swarm dispatch.

### Silicon Horizon
A conceptual term for the boundary of autonomous reasoning. Missions targeting the "Silicon Horizon" are typically those involving deep hierarchical swarms (depth > 2) and synthesis of multi-domain research.

### Swarm Depth
The recursive level of sub-agent spawning. Tadpole OS enforces a strict **limit of 5** to prevent infinite recursion.
- **Depth 0**: Direct User-to-Agent task.
- **Depth 1**: Overlord spawned an Alpha Node.
- **Depth 2-5**: Secondary and tertiary specialists.

### Parallel Swarming (PERF-06)
The engine's ability to execute multiple tool calls (e.g., spawning 3 researchers) concurrently. This uses Rust's `FuturesUnordered` to significantly reduce latency in hierarchical swarms compared to sequential tool execution.

### Swarm Lineage (Recruitment Chain)
The deterministic tracking of agent ancestry within a mission. The engine uses this lineage to block any agent from recruiting an ancestor, preventing circular "ping-pong" loops (e.g., A -> B -> A).

### Unified Synthesis Engine
The backend logic in `runner.rs` that standardizes how agents from different providers (Gemini, Groq) merge their findings into a single, structured report.

### Self-Healing Retry (Groq)
A resilience layer in the Groq provider that automatically detects `tool_use_failed` errors (400) caused by malformed JSON. It performs an immediate, corrective retry to ensure mission continuity without manual intervention.

### Groq Whisper
A high-fidelity speech-to-text model (`whisper-large-v3`) utilized by the backend to ensure precise transcription of user intent for the sovereignty handoff.

## Operational Terms

### Budget USD (Fiscal Gate)
A hard limit on the monetary cost of a mission. The engine calculates token costs in real-time and will automatically pause the mission if this limit is reached.

### Oversight Gate (Human-in-the-Loop)
The security interception layer. It pauses agent execution during "sensitive" tool calls (like writing files or completing missions) until a human user approves the action via the dashboard.

### Neural Vault
A secure, client-side encrypted storage for LLM API keys. It uses AES-256 to ensure keys remain private even if the browser session is intercepted.

### Capability Synchronization (Sync)
The process of ensuring an agent's assigned **Skills** and **Workflows** are loaded into their `RunContext`. Originally hardcoded, these are now natively resolved from the dynamic file-system registry on every turn, allowing rapid iteration without restarts.

### Dynamic Skills
Custom, user-defined tools created via the Operative interface. They consist of a JSON schema defining parameters and an execution script (Bash, PowerShell, Python, etc.) that the engine securely runs as a subprocess.

### Passive Workflows
Markdown-based directives stored in the capabilities registry. They function as persistent "knowledge drops" or multi-step SOPs that are injected directly into an agent's system prompt during execution.

### Mission Cluster (Logical Cluster)
The frontend organizational unit for a group of agents. Clusters are managed via the `workspaceStore.ts` and persisted in the browser's LocalStorage. They determine the high-level objective and provide the "Strategic context" for the agents within.

### Workspace (Physical Sandbox)
The backend directory (located in `workspaces/`) used as a secure, isolated environment for an agent's file-based tool calls. Every Mission Cluster maps to a specific workspace to ensure agents can only interact with files relevant to their mission.

### Atomic Synchronization (Load-then-Swap)
A fail-safe mechanism for the capabilities registry. The engine loads and validates new skills/workflows in a background buffer before hot-swapping the active memory registry, preventing configuration corruption or downtime during rapid updates.

### Process Guard (Execution Timeout)
An asynchronous watchdog that monitors dynamic skill execution. It enforces a strict **60-second limit** by default, automatically terminating any script that hangs or exceeds its resource window to maintain engine responsiveness.

### Lifecycle Hooks (SEC-04)
Security-first governance scripts (`pre-tool` and `post-tool`) executed by the engine before and after any tool call. They provide a "Bunker-Grade" auditing layer for sensitive operations.

### Mission Badge
A high-density UI component that displays the current operational objective. It features a rectangular design (`rounded-md`) and is **scrollable** to accommodate multi-step mission directives without impacting overall grid alignment.
