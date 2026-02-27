# 🗺️ Codebase Map (AI Navigator)

This map is designed to help AI assistants (and human developers) navigate the Tadpole OS project structure and understand component relationships.

## Backend: Rust Engine (`server-rs/`)

| Directory / File | Purpose | Key Notes |
| :--- | :--- | :--- |
| `src/agent/runner.rs` | **Execution Core** | Parallel swarming (`FuturesUnordered`), intent handoffs, governance |
| `src/agent/hooks.rs` | **Lifecycle Hooks** | `HooksManager` for `pre-tool` and `post-tool` auditing |
| `src/agent/gemini.rs` | **Google Provider** | Concurrent tool call support via `generate` |
| `src/agent/groq.rs` | **Groq Provider** | Shared client + Llama tool-call recovery; unused struct fields removed |
| `src/agent/rate_limiter.rs` | **API Quota Guard** | `Semaphore`-based RPM + `AtomicU32` TPM; auto-enforced in `call_provider` |
| `src/agent/mission.rs` | **Mission CRUD** | `row_to_mission()` helper eliminates 3× DRY violation; `str_to_status()` |
| `src/agent/persistence.rs` | **Disk Sync** | SQLite primary; JSON opt-in via `LEGACY_JSON_BACKUP=true` |
| `src/agent/registry.rs` | **Default Agents** | 26+ pre-configured agent definitions |
| `src/agent/rates.rs` | **Cost Calculator** | USD-per-token rates for all known models |
| `src/agent/capabilities.rs` | **Dynamic Capabilities** | File-system registry for Skills and Workflows |
| `src/agent/types.rs` | **Type Definitions** | Source of truth for `TaskPayload`, `ModelConfig`, `EngineAgent`, etc. |
| `src/adapter/filesystem.rs` | **Workspace I/O** | Sandboxed ops; `canonicalize`-based symlink-safe containment check |
| `src/adapter/vault.rs` | **Vault Persistence** | Appends Markdown files to `vault/` directory |
| `src/adapter/discord.rs` | **Discord Webhook** | Sends alerts via `DISCORD_WEBHOOK` env var |
| `src/routes/ws.rs` | **WebSocket Hub** | Multiplexes `broadcast::Sender<LogEntry>` and `event_tx` streams |
| `src/routes/audio.rs` | **Transcription** | Accepts multipart audio → Groq Whisper; uses shared HTTP client |
| `src/routes/agent.rs` | **REST Handlers** | Agent CRUD, mission dispatch, oversight decisions |
| `src/routes/capabilities.rs` | **Capabilities REST** | Custom capabilities CRUD API |
| `src/state.rs` | **AppState** | Shared `http_client` (Arc), `DashMap` registries, `oversight_queue` |
| `src/main.rs` | **Entry Point** | Axum router, axum state injection |
| `workspaces/` | **Physical Sandboxes** | One directory per cluster; mapped from `cluster_id` in `RunContext` |

### Data Flow (State Persistence)
`Registry (Static)` → `DB (Persistence)` → `AppState (DashMap)` → `Runner (Execution)` → `Workspace (Files)`

> **Mission Clusters** (logical organization) are persisted in Frontend **LocalStorage** (`tadpole-workspaces-v3`), not in the Rust backend.

## Frontend: React Dashboard (`src/`)

| Directory | Purpose | Key Files |
| :--- | :--- | :--- |
| `pages/` | **Views** | `Dashboard.tsx`, `Hierarchy.tsx`, `Missions.tsx`, `Workspaces.tsx`, `Capabilities.tsx` |
| `services/` | **Engine Link** | `OpenClawService.ts` (REST), `openclawSocket.ts` (WS), `capabilitiesStore.ts` |
| `store/` | **Reactive State** | `agentStore.ts` (Zustand), `settingsStore.ts`, `roleStore.ts` |
| `components/` | **Units** | `AgentCard.tsx`, `OversightPortal.tsx`, `CommandPalette.tsx` |

## Deployment & Ops

- **`Dockerfile`**: Multi-stage build. Frontend TS build → Rust release build → slim runtime image.
- **`deploy.ps1`**: Hybrid automation (Local Frontend Build → Remote Docker Rebuild).
- **`.env`**: Core security boundary. `NEURAL_TOKEN` is **required** — engine panics at startup in release builds if missing.

## AI Navigation Tips

- **Find mission schema changes**: `grep` on `server-rs/src/agent/types.rs`
- **Trace a tool call**: Start in `runner.rs:execute_tool()`, then follow the `handle_*` method
- **Rate limit config**: `ModelConfig.rpm` / `ModelConfig.tpm` → enforced in `runner.rs:call_provider()` via `rate_limiter.rs`
- **Workspace path**: Always `ctx.workspace_root` — never hardcode
- **State audit**: Check `state.rs` — `AppState` is the single source of truth for all live data
- **Sovereignty flow**: See `Standups.tsx` for audio capture → `routes/audio.rs` → Groq Whisper → `runner.rs:handle_issue_alpha_directive()`
- **Security boundary**: `adapter/filesystem.rs:get_safe_path()` — do not bypass
