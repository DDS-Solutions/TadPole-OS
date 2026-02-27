# Tadpole OS — Getting Started Guide

> **Prerequisites**: Tadpole OS running locally (`start_tadpole.bat`) or deployed on your Swarm Bunker (Linux or Similar Sandbox for Production Deployment). You'll need a Groq API key from [console.groq.com](https://console.groq.com).

## 🏗️ Hardware Requirements (Scaling Spec)

Tadpole OS is optimized for low-footprint Rust execution. Requirements scale linearly with agent count and mission complexity.

| Tier | Agents | Clusters | **Min RAM** | **vCPU** | Deployment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Micro (Demo)** | 1-2 | 1 | **1 GB** | 1 | Hybrid |
| **Standard (Bunker)** | 2-9 | 1-2 | **2 GB** | 2 | Hybrid |
| **Cluster Max** | 10-25 | 4+ | **4 GB** | 4 | Hybrid |
| **ROBUST (PRO)** | 25+ | Full | **8 GB+** | 4-8 | Full Remote |

> [!TIP]
> **Robust Recommendation**: For high-vocal missions with real-time audio and massive `fetch_url` research, an **8GB / 4-vCPU** instance ensures zero latency in the context bus and allows for full remote rebuilds without OOMs.

---

## Step 1: Connect to the Engine

1. Open Tadpole OS in your browser (default: `http://localhost:5173`)
2. Go to **⚙️ Settings** from the sidebar
3. Under **Engine Connection**, verify the URL is set to:
   - Local: `http://localhost:8000`
   - Linux box: `http://tadpole-linux:8000`
4. Click **Save Changes**
5. The dashboard status indicator should show **🟢 ONLINE**

> [!IMPORTANT]
> **Windows Users**: For reliable database persistence, set your `DATABASE_URL` using an **absolute path** (e.g., `sqlite:C:\Users\Name\.gemini\...\tadpole.db`). Relative paths in Rust on Windows can sometimes fail to resolve across different startup contexts.

---

## Step 2: Unlock the Neural Vault & Add Your Groq Provider

The Neural Vault is an encrypted vault that stores your API keys. You must unlock it before configuring providers.

1. Go to **🧠 Providers** from the sidebar
2. You'll see the **NEURAL VAULT** lock screen
3. Enter a master password (this encrypts your keys locally) → click **UNLOCK**
4. You'll now see the **Provider Cards** section

### Adding Groq as a Provider

5. If Groq is already listed, click the **Edit** (pencil) icon on the Groq card
6. If not listed, click **+ ADD PROVIDER** at the bottom:
   - **Name**: `Groq`
   - **Icon**: `⚡` (or any emoji)
   - Click **Create**
7. On the Groq provider card:
   - **API Key**: Paste your Groq API key
   - **Base URL**: `https://api.groq.com/openai/v1`
   - **Protocol**: `OpenAI (OpenRT)` — Groq uses OpenAI-compatible API
8. Click **Save** on the provider card

> [!TIP]
> The vault auto-locks after inactivity. Your key is encrypted with your master password and stored in the browser — it never leaves your machine.

---

## Step 3: Add Models

Still on the **🧠 Providers** page, scroll down to the **Model Registry** section.

1. Click **+ ADD MODEL**
2. Fill in:
   - **Model Name**: `llama-3.3-70b-versatile`
   - **Provider**: Select `Groq` from the dropdown
   - **RPM** *(optional)*: e.g., `30` — prevents exceeding Groq's free-tier rate limits
   - **TPM** *(optional)*: e.g., `14000` — the engine will throttle automatically
3. Click the **✓** checkmark to save

**Recommended Groq models to add:**

| Model Name | Best For |
|------------|----------|
| `llama-3.3-70b-versatile` | General tasks, tool calling |
| `llama-3.1-8b-instant` | Fast responses, simple tasks |
| `mixtral-8x7b-32768` | Long-context tasks |

Repeat for each model you want available.

---

## Step 4: Configure an Agent

1. Go to **🏛️ Hierarchy** from the sidebar
2. You'll see the **Neural Command Hierarchy** — your agent org chart
3. Click on any agent card (e.g., **Nexus**, **Cipher**, etc.)
4. The **Agent Config Panel** slides open on the right

### In the Config Panel:

5. **Identity Section** (top):
   - **Name**: Give it a descriptive name (e.g., `Research Bot`)
   - **Role**: Select from the dropdown (e.g., `Researcher`, `Engineer`, `Analyst`)

6. **Primary Model Slot**:
   - **Model**: Select `llama-3.3-70b-versatile` from the dropdown
   - **Provider**: Should auto-fill as `Groq`
   - **Temperature**: `0.7` for balanced output, `0.2` for precise, `0.9` for creative

7. **Skills & Workflows** (expandable section):
   - Toggle skills like `web_search`, `file_write`, `code_execute`
   - These determine what tools the agent can use during missions

8. Click **💾 SAVE CONFIG** at the bottom

> [!IMPORTANT]
> The save pushes your config to the Rust backend, so it persists across devices and restarts. You'll see the agent's role/model update live on the hierarchy.

---

## Step 4.5: Creating Custom Skills & Workflows (Optional)

If your agents need to execute custom code, interact with internal APIs, or follow specific SOPs, you can define these dynamically.

1. Go to **🛠️ Skills & Workflows** from the sidebar
2. **To create a Skill (Execution Tool)**:
   - Click **+ NEW SKILL** in the Skills tab
   - Define the JSON schema (what parameters the agent must provide)
   - Define the Execution Command (e.g., `python fetch_data.py {{arg1}}`)
   - Save. It's immediately available to assign to any agent in the Config Panel.
3. **To create a Workflow (Passive Knowledge)**:
   - Click **+ NEW WORKFLOW** in the Workflows tab
   - Write Markdown guidelines (e.g., "Always cite sources in APA format").
   - Save. This text is injected into the agent's system prompt when assigned.

---

## Step 5: Create a Mission

1. Go to **🎯 Missions** from the sidebar
2. Click **+ NEW MISSION** in the top-right of the cluster sidebar
3. Fill in:
   - **Mission Name**: e.g., `Market Research Sprint`
   - **Department**: Select the relevant department (e.g., `Research`)
4. Click **Create**

### Assign Agents to the Mission:

5. Select your new mission in the sidebar (it'll highlight)
6. In the **Available Agents** pool on the right, click **+ Assign** next to each agent you want on this mission
8. **Intelligent Swarms**: High-level agents (Alphas) can spawn ephemeral sub-agents. The engine automatically tracks the **Swarm Lineage** to prevent circular recursion (e.g., A recruiting B, then B recruiting A).
9.  **Parallel Swarming (PERF-06)**: **Tadpole OS** automatically parallelizes tool calls. Recruitment of multiple specialists happens simultaneously, dramatically reducing swarm startup latency.
10. **Neural Swarm Optimization**: When you type an objective, you may see a "Neural Swarm Optimization Proffered" banner. This is the AI suggesting a "Best Practice" setup. 
11. **Recursion Guard**: To prevent infinite token burn, the engine enforces a maximum **Swarm Depth of 5**.

---

## Step 6: Workspace & Cluster Management

Tadpole OS allows you to organize your swarm into **Mission Clusters**.

- **Defaults**: The engine starts with 3 predefined clusters (Strategic Ops, Core Intelligence, Applied Growth).
- **Custom Scaling**: You can create new clusters or retire existing ones from the **🎯 Missions** page.
- **Persistence**: Unlike agent roles which are stored in the backend database, the **list of clusters is stored in your browser's LocalStorage**. This means your custom organization is unique to your session unless shared.
- **Physical Sandboxes**: Each cluster maps to a dedicated directory in the backend `workspaces/` folder, ensuring file isolation between different mission groups.

---

## Step 7: External Adapters & Workspace Tools

The engine can now connect to your local environment and external services.

### Workspace File Operations
Agents with matching skills can read and write files within their cluster sandbox:
- **`read_file`**: Read a file from the workspace (e.g., load a spec document).
- **`write_file`**: Write a file to the workspace (e.g., save generated code).
- **`list_files`**: List files in a workspace directory.
- **`delete_file`**: Delete a file *(requires Oversight Gate approval)*.

Files are stored under `workspaces/<cluster-id>/` on the server. Each cluster is fully isolated.

### Local Markdown Vault (Obsidian)
Enabled agents can now use the `archive_to_vault` tool.
1. Create a `vault/` directory in the `server-rs` root.
2. Agents will automatically append findings to files in this directory when requested.

### Discord Notifications
1. Add `DISCORD_WEBHOOK="your_webhook_url"` to your `.env` file.
2. Use the `notify_discord` tool from an agent to alert your team.

### Environment Security (.env)
Ensure your `.env` file in the root directory contains:

| Variable | Description | Requirement |
| :--- | :--- | :--- |
| `DATABASE_URL` | Path to `tadpole.db` | **Absolute path REQUIRED on Windows** |
| `NEURAL_TOKEN` | Auth token for WebSocket/API access | **Required in production** — engine panics at startup if not set. |
| `LIFECYCLE_HOOKS_ENABLED` | Toggle pre/post execution hooks | Default: `true` |
| `GOOGLE_API_KEY` | Gemini Reasoning Key | Required for Google Provider |
| `GROQ_API_KEY` | Llama Reasoning Key | Required for Groq Provider |
| `ALLOWED_ORIGINS` | CORS Policy | e.g., `http://localhost:5173` |
| `LEGACY_JSON_BACKUP` | Enable `agents.json` fallback writes | Optional. Set to `true` to enable |
| `DISCORD_WEBHOOK` | Discord notification URL | Required only for `notify_discord` tool |

---

## Step 6: Send a Task & Get Results

### Option A: From the Terminal Bar

The terminal bar is at the bottom of every page.

1. Click the terminal input field
2. Type a command:
   ```
   /send Research Bot Analyze the top 3 competitors in the AI agent space and summarize their pricing models
   ```
   Format: `/send <agent-name> <your task message>`
3. Press **Enter**
4. Watch the **System Log** on the dashboard — you'll see:
   - `📡 Task dispatched to Research Bot`
   - Live agent status updates
   - The final response from the LLM

3. Type your task and click **Send**

### Option E: Command Palette (Global Nav)

1. Press **`Cmd+K`** (Mac) or **`Ctrl+K`** (Windows) anywhere.
2. Search for an Agent, Cluster, or Directive.
3. Select an agent to instantly focus them in the chat interface.

### Option C: From the OPS Dashboard

1. Go to the **Dashboard** (home page)
2. The **Live Agent Status** cards show real-time activity
3. The **System Log** captures all responses and events

### Option D: Neural Sync (Voice-to-Swarm)

1. Go to **🎙️ Standups** from the sidebar
2. **Select Target**: Choose an Agent (e.g., Agent of Nine) or a Mission Cluster.
3. Click **Start Sync** → Speak your high-level objective clearly.
4. Click **End Sync** → The system will transcribe your voice via **Groq Whisper** and dispatch it to the **Agent of Nine** for strategic refinement and autonomous handoff.

---

## Useful Terminal Commands

| Command | What it does |
|---------|-------------|
| `/send <agent> <message>` | Send a task to a specific agent |
| `/pause <agent>` | Pause a running agent |
| `/resume <agent>` | Resume a paused agent |
| `/status` | Show all agent statuses |
| `/health` | Check engine connection |
| `/clear` | Clear the system log |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard shows **OFFLINE** | Check that the engine is running (`npm run engine` or Docker container is up) |
| Agent returns no response | Verify the model exists in the Model Registry and the API key is valid |
| Neural Vault won't unlock | The vault creates a new encryption key on first use — use any password |
| Model dropdown is empty | Go to **🧠 Providers** → unlock vault → add models to the registry |
| Agent config doesn't save | Check browser console — engine must be online for persistence to work |
| Tool-Calling fails (Groq) | The engine includes **Self-Healing Retries** for Groq. Malformed tool syntax is automatically corrected in a second pass. |
| Agent is slow / rate limited | The engine enforces `rpm`/`tpm` limits set on the model. The agent will wait for the quota window to reset rather than drop requests. |
| `NEURAL_TOKEN` panic on start | A `NEURAL_TOKEN` env var is required in production builds. Set it in your `.env` file. Dev builds use an insecure fallback. |
| Workspace file access denied | Agent tried to access a path outside its sandbox. Check `cluster_id` mapping and ensure no path traversal in the filename. |

---

## Architecture Quick Reference

```
┌─────────────────────────────────────┐
│         Your Browser (React)        │
│  Dashboard │ Hierarchy │ Missions   │
│  Providers │ Oversight │ Settings   │
└───────────────┬─────────────────────┘
                │ HTTP + WebSocket
┌───────────────▼─────────────────────┐
│       Rust Engine (port 8000)       │
│  Agent Registry │ Task Router       │
│  Oversight Gate │ Persistence       │
└───────────────┬─────────────────────┘
                │ API Calls
┌───────────────▼─────────────────────┐
│        LLM Provider (Groq)          │
│  llama-3.3-70b │ mixtral-8x7b      │
└─────────────────────────────────────┘
```
