# API Reference — Tadpole OS Engine

> Base URL: `http://localhost:8000` (Rust Backend)

All endpoints (except health) require `Authorization: Bearer <NEURAL_TOKEN>`.

---

## REST API — Tadpole OS Engine (Rust)

### Health & Control

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/engine/health` | ✗ | Returns `200 OK` + realtime diagnostics. |
| `POST` | `/engine/deploy` | ✓ | Triggers a production deployment via PowerShell. |
| `POST` | `/engine/kill`   | ✓ | Halts all running agents. Server remains online. |
| `POST` | `/engine/shutdown` | ✓ | Graceful server shutdown. Persists state before exit. |
| `POST` | `/engine/transcribe` | ✓ | Transcribes an uploaded audio file. |

### Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/agents` | ✓ | Lists all agents (from DashMap + DB). |
| `POST` | `/agents` | ✓ | Creates or registers a new agent. |
| `POST` | `/agents/:id/send` | ✓ | Sends a task payload to the Rust agent runner. |
| `PUT` | `/agents/:id` | ✓ | Updates agent configuration and fields. |
| `POST` | `/agents/:id/pause` | ✓ | Pauses an active agent. |
| `POST` | `/agents/:id/resume` | ✓ | Resumes an idle or paused agent. |

#### `POST /agents/:id/send` — Request Body

```json
{
  "message": "Analyze security posture",
  "clusterId": null,
  "department": "Security",
  "provider": "google",
  "modelId": "gemini-2.0-flash",
  "apiKey": null,
  "baseUrl": null,
  "rpm": 15,
  "tpm": 1000000,
  "budgetUsd": 5.0,
  "swarmDepth": 0,
  "swarmLineage": [],
  "externalId": null
}
```

### Oversight

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/oversight/pending` | ✓ | Lists pending oversight entries awaiting approval. |
| `GET`  | `/oversight/ledger`  | ✓ | Lists recently decided oversight entries (bounded). |
| `POST` | `/oversight/:id/decide` | ✓ | Approves or rejects a pending entry. |
| `PUT`  | `/oversight/settings` | ✓ | Updates global governance settings (e.g. `autoApproveSafeSkills`). |

### Infrastructure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/infra/providers` | ✓ | Lists all LLM providers. |
| `PUT` | `/infra/providers/:id` | ✓ | Updates a provider (key, URL, protocol). |
| `GET` | `/infra/models` | ✓ | Lists all registered models. |
| `PUT` | `/infra/models/:id` | ✓ | Updates a model entry. |

### Capabilities (Dynamic Skills & Workflows)

| Method | Path | Auth | Success | Error | Description |
|--------|------|------|---------|-------|-------------|
| `GET`  | `/system/capabilities` | ✓ | `200 OK` | `...` | Returns lists of available skills and workflows with metadata (`id`, `tags`, `doc_url`). |
| `PUT`  | `/system/skills/:name`       | ✓ | `200 OK` | `500` | Creates or updates a dynamic skill (JSON format). Supports `tags` and `doc_url`. |
| `DELETE`| `/system/skills/:name` | ✓ | `200 OK` | `500` | Deletes a dynamic skill by name. |
| `PUT`  | `/system/workflows/:name`    | ✓ | `200 OK` | `500` | Creates or updates a passive workflow (Markdown format). |
| `DELETE`| `/system/workflows/:name`| ✓ | `200 OK` | `500` | Deletes a workflow by name. |

#### Lifecycle Hooks Governance

The engine periodically scans `server-rs/data/hooks` for executable scripts named `pre-tool` and `post-tool`. These are not currently exposed via the public REST API but are managed at the filesystem level for high-security bunker deployments.


---

## WebSocket Events

Connect to `ws://localhost:8000/engine/ws` (Rust Engine WebSocket Hub).

### Server → Client

| Event Type | Payload | Description |
|------------|---------|-------------|
| `engine:health` | `{ uptime, agents, latencyMs, throttleStats }` | Heartbeat (every 5s) |
| `agent:status` | `{ agentId, status }` | Agent status change (thinking, idle, etc.) |
| `agent:message` | `{ agentId, text }` | Agent output text |
| `agent:update` | `{ agentId, data: EngineAgent }` | Full agent state sync |
| `oversight:new` | `{ entry: OversightEntry }` | New pending oversight request |
| `oversight:decision` | `{ id, decision }` | Oversight decision broadcast |
| `system:message` | `{ text, level }` | System-level notifications (info, warning, error, success) |

### Client → Server

WebSocket messages should be JSON with a `type` field:

```json
{
  "type": "agent:send",
  "agentId": "2",
  "message": "Hello"
}
```

---

## Error Format (RFC 9457)

All errors follow the **Problem Details for HTTP APIs** format, providing top-tier observability and machine-readability:

```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Agent Not Found",
  "status": 404,
  "detail": "The agent with ID 'xyz' does not exist in the active swarm registry.",
  "instance": "/agents/xyz",
  "message": "The agent with ID 'xyz' does not exist in the active swarm registry."
}
```

> [!NOTE]
> The `message` field is maintained for backward compatibility with legacy frontend integrations, while `detail` provides the standardized RFC 9457 description.

---

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <NEURAL_TOKEN>
```

The token is configured via the `NEURAL_TOKEN` environment variable.

> [!IMPORTANT]
> **Production requirement**: `NEURAL_TOKEN` must be explicitly set. The engine panics at startup in release builds if the variable is missing — there is no insecure fallback. Development builds will log a loud warning and use a temporary placeholder, but this is not safe for any externally-accessible deployment.
