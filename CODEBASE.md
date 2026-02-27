# 📂 Tadpole OS Codebase Guide

## Project Structure

This project is a high-performance **Tadpole OS** runtime with a **Rust-based Backend** and a **React/Vite Frontend**.

### Top-Level Directories

- **`server-rs/`**: The core **Tadpole OS** engine.
    - **`src/main.rs`**: Axum entry point.
    - **`src/agent/`**: The Intelligence Layer.
        - `runner.rs`: The mission execution loop (Concurrent & Parallel).
        - `hooks.rs`: Lifecycle execution governance (`pre-tool`/`post-tool`).
        - `registry.rs`: The centralized agent database (26+ agents).
        - `capabilities.rs`: Dynamic file-system registry for Skills & Workflows.
        - `gemini.rs`: Google provider with concurrent tool call support.
        - `groq.rs`: Groq provider with self-healing Llama retry.
    - **`src/routes/`**: API handlers for capabilities, missions, and system status.
- **`src/`**: The React Dashboard (Frontend).
    - **`pages/`**: Views: `OpsDashboard`, `Missions`, `Hierarchy`, `Standups`.
    - **`components/`**: UI Elements: `AgentCard`, `CommandPalette`, `NeuralPulse`.
    - **`services/`**: REST and WebSocket clients.
- **`workspaces/`**: Physical sandboxes isolated per cluster.

## Key Files & Entry Points

- **Backend Start**: `npm run engine` (port 8000)
- **Frontend Start**: `npm run dev` (port 5173)
- **Primary Logic**: `server-rs/src/agent/runner.rs`
- **Identity & Life**: `server-rs/data/context/IDENTITY.md`

## Coding Conventions

### Language
- **Rust**: Functional-style async concurrency using `FuturesUnordered` for parallel tasking.
- **TypeScript**: Typed state management via **Zustand**.

### State Management
- **Backend (Rust)**: High-concurrency `DashMap` for agent and mission registries.
- **Frontend (TS)**: Reactive stores for agents, roles, and settings.

### Design System: "Neural Glass"
- **Aesthetic**: Cinematic dark mode, glassmorphism, pulsating status rings.

## Build & Run

1. `npm run engine`
2. `npm run dev`

## Troubleshooting

- **"OFFLINE" Dashboard**: Check if `NEURAL_TOKEN` is set in `.env` and engine is at :8000.
- **Parallel Failures**: Verify RPM/TPM limits in the Model Registry.
