# Tadpole-OS Development Task List

- [x] **Project Initialization** <!-- id: 0 -->
    - [x] Create `task.md` <!-- id: 1 -->
    - [x] Create initial `implementation_plan.md` <!-- id: 2 -->
    - [x] Brainstorm features and architecture <!-- id: 3 -->

- [x] **Design & Planning** <!-- id: 4 -->
    - [x] Run `ui-ux-pro-max` to generate Design System <!-- id: 5 -->
    - [x] Define Agent Org Chart Structure <!-- id: 6 -->
    - [x] Define Dashboard Layout (Ops Module, Task Manager) <!-- id: 7 -->

- [ ] **Implementation - Phase 4: Budgeting & Governance** <!-- id: 48 -->
    - [ ] Create implementation plan for budgeting features <!-- id: 49 -->
    - [ ] [Backend] Update types and mission initialization with budget support <!-- id: 50 -->
    - [ ] [Backend] Implement "Emergency Pause" logic <!-- id: 52 -->
    - [x] Implement "Add New Agent" button in `AgentManager.tsx`
    - [x] Integrate Agent Creation with `AgentConfigPanel`
    - [x] Add backend persistence for new agents in Rust
    - [x] Allow custom modality entry
    - [x] Fix state-reset bug in ModelRow and ForgeItem
    - [x] Unify ModelEntry interface in providerStore.ts
    - [x] Add modality fields to infra_models.json
    - [x] Enforce 25-agent capacity limit
    - [ ] [Frontend] Add Budget field to Mission Creation UI <!-- id: 53 -->
    - [ ] [Frontend] Implement "Burn Rate" visualization on Dashboard <!-- id: 54 -->
    - [ ] [Audit] Verify Finance Analyst agent capabilities <!-- id: 55 -->

- [x] **Verification & Polish** <!-- id: 18 -->

- [x] **Implementation - Phase 2: Agent Management** <!-- id: 12 -->
    - [x] Implement Org Chart Visualization <!-- id: 13 -->
    - [x] Implement Workspaces/Context View <!-- id: 14 -->

- [x] **Implementation - Phase 3: Advanced Features** <!-- id: 15 -->
    - [x] Implement Voice Standups (UI + Mock/TTS) <!-- id: 16 -->
    - [x] Implement Living Documentation System <!-- id: 17 -->

- [x] **Verification & Polish** <!-- id: 18 -->
    - [x] Verify UI against "Muddy OS" reference <!-- id: 19 -->
    - [x] Add comments for `@[/enhance]` readiness (See README.md) <!-- id: 20 -->
    - [x] Final functional test (Build Clean) <!-- id: 21 -->
    - [x] Locate Mission Budget field location <!-- id: 46 -->
    - [x] Analyze and Propose Budgeting & Governance Strategy <!-- id: 47 -->

- [x] **Provider Testing** <!-- id: 22 -->
    - [x] `server/providers/openai.ts` unit tests (`87.5%` Coverage) <!-- id: 23 -->
    - [x] `server/providers/gemini.ts` unit tests (`82.35%` Coverage) <!-- id: 24 -->
    - [x] `server/providers/groq.ts` unit tests (`76.66%` Coverage) <!-- id: 25 -->

- [-] **Deep Robustness Sprint** <!-- id: 26 -->
    - [x] Standardize error handling in `server/` (replace `any` with `unknown` and type guards) <!-- id: 27 -->
    - [x] Integrate global type definitions (`Dept`, `AgentStatus`) across `src/` and `server/` <!-- id: 28 -->
    - [x] Resolve lint errors (Reduced from 170+ to ~118) <!-- id: 29 -->
        - [x] Fix `server/dist` ignore pattern <!-- id: 30 -->
        - [x] Fix `no-explicit-any` in usage <!-- id: 31 -->
        - [x] Fix `useEffect` state updates in `OpsDashboard.tsx` <!-- id: 32 -->
        - [x] Fix conditional hooks in `HierarchyNode.tsx` <!-- id: 33 -->
        - [x] Fix Fast Refresh issues in `ModelBadge.tsx` <!-- id: 34 -->

- [x] **Implementation - Phase 5: REST Standard Test Suites** <!-- id: 60 -->
    - [x] [Backend] Add `tests_capabilities.rs` for registry parsing verification <!-- id: 61 -->
    - [x] [Backend] Update `tests.rs` with runner synthesis mock unit tests <!-- id: 62 -->
    - [x] [Frontend] Add `capabilitiesStore.test.ts` to assert fetch mapping <!-- id: 63 -->
    - [x] [Frontend] Add `sovereignStore.test.ts` to assert Chat tab sync logic <!-- id: 64 -->
