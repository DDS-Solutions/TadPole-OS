# 🐸 Tadpole OS Contribution Standards

Welcome, Overlord. To maintain the sovereignty and performance of Tadpole OS, please follow these guidelines when contributing.

## The 3-Layer Logic
All code contributions must respect our architecture:
1. **Directive (YAML/MD)**: Standardized instructions.
2. **Orchestration (Rust/TS)**: Intelligent routing and state management.
3. **Execution (Sub-processes/Tools)**: Deterministic execution.

## Pull Request Process
1. **Fork the Repo**: Create your own tactical instance.
2. **Feature Branches**: Use descriptive names (`feat/neural-pulse`, `fix/rate-limiter`).
3. **Rust Integrity**: All `cargo check` and `cargo test` runs must pass in the `server-rs` directory.
4. **Dashboard Quality**: Ensure `npm run lint` and `npm run build` pass for the Operations Center.
5. **Documentation**: Update `GLOSSARY.md` or `ARCHITECTURE.md` if introducing new concepts.

## Coding Standards
- **Rust**: Use `Clippy` and follow idiomatic patterns.
- **React**: Use functional components with Tailwind CSS variables for theme synergy.
- **Security**: Never hardcode keys. Use the `.env` protocol.

Thank you for strengthening the swarm.
