/**
 * @module agentService
 * Dedicated service for agent data loading and management.
 * Extracts the loading logic from mockAgents.ts to create a proper
 * separation between data definitions and service behavior.
 */

import { agents as mockAgents } from '../data/mockAgents';
import { OpenClawService } from './openclawService';
import type { Agent } from '../types';

const STORAGE_KEY = 'tadpole-agent-overrides';

type AgentOverride = Partial<Agent> & {
    provider?: string;
    provider2?: string;
    provider3?: string;
    skills?: string[];
    workflows?: string[];
};

/**
 * Normalizes a raw agent object from the backend (or WebSocket) into the frontend Agent type.
 * Applies local overrides and ensures schema parity.
 */
export const normalizeAgent = (raw: any, overrides: Record<string, AgentOverride> = {}, workspacePath?: string): Agent => {
    const override = overrides[raw.id] || {};

    const rawDept = raw.department || raw.metadata?.department || 'Operations';
    const dept = rawDept === 'QA' ? 'Quality Assurance' : rawDept;

    return {
        id: raw.id,
        name: raw.name,
        role: raw.role || raw.metadata?.role || 'AI Agent',
        department: dept as any, // Cast to any because the union is strict, but Department type is imported
        status: (raw.status === 'working' ? 'active' : raw.status) || 'idle',
        tokensUsed: 0,
        // Match the logic from openclawService transformation
        model: (typeof raw.model === 'string' ? raw.model : raw.modelConfig?.modelId) || 'Unknown',
        modelConfig: raw.modelConfig || raw.model,
        workspacePath: workspacePath || raw.workspace,
        currentTask: undefined,
        capabilities: raw.skills || [],
        workflows: raw.workflows || [],
        themeColor: raw.themeColor,
        budgetUsd: raw.budgetUsd || 0,
        costUsd: raw.costUsd || 0,
        model2: raw.model2,
        model3: raw.model3,
        modelConfig2: raw.modelConfig2,
        modelConfig3: raw.modelConfig3,
        activeModelSlot: raw.activeModelSlot as 1 | 2 | 3,
        ...override, // Apply overrides last
    };
};

/**
 * Loads agents from the Rust engine if available, falling back to mock data only if offline.
 * Trusting the server is the key to cross-device parity.
 */
export const loadAgents = async (): Promise<Agent[]> => {
    let rawAgents: Agent[] = [];
    try {
        const isConnected = await OpenClawService.checkHealth();

        if (isConnected) {
            const liveAgents = await OpenClawService.getAgents();
            if (liveAgents.length > 0) {
                rawAgents = [...liveAgents];
            }
        }
    } catch {
        // Offline mode — fall back to local mock agents silently
    }

    // If we couldn't get anything from the server, we populate with mocks for local dev
    if (rawAgents.length === 0) {
        rawAgents = mockAgents.map(ma => ({
            ...ma,
            name: `${ma.name} (Simulated)`,
            status: 'offline' as const
        }));
    }

    const overridesRaw = localStorage.getItem(STORAGE_KEY);
    const overrides: Record<string, AgentOverride> = overridesRaw ? JSON.parse(overridesRaw) : {};

    let workspaceStore: any;
    try {
        workspaceStore = await import('./workspaceStore');
    } catch (e) {
        console.warn('⚠️ [AgentService] Failed to load workspaceStore:', e);
    }

    return rawAgents.map(raw => {
        const workspacePath = workspaceStore?.useWorkspaceStore?.getState()?.getAgentPath(raw.id);
        return normalizeAgent(raw, overrides, workspacePath);
    });
};

/**
 * Persists an agent update. 
 * PROACTIVE PARITY: It saves to local storage AND emits an update to the backend registry immediately.
 */
export const persistAgentUpdate = async (agentId: string, updates: AgentOverride) => {
    // 1. Save to LocalStorage for instant UI feedback & offline persistence
    const prevRaw = localStorage.getItem(STORAGE_KEY);
    const overrides: Record<string, AgentOverride> = prevRaw ? JSON.parse(prevRaw) : {};

    overrides[agentId] = {
        ...(overrides[agentId] || {}),
        ...updates
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));

    // 2. Sync to Backend for Global Parity
    try {
        const config: any = {};
        if (updates.role !== undefined) config.role = updates.role;
        if (updates.name !== undefined) config.name = updates.name;
        if (updates.model !== undefined) {
            config.modelId = updates.model;
            if (updates.modelConfig?.provider) config.provider = updates.modelConfig.provider;
        }
        if (updates.modelConfig !== undefined) {
            config.modelId = updates.modelConfig.modelId;
            config.provider = updates.modelConfig.provider;
            config.temperature = updates.modelConfig.temperature;
            config.systemPrompt = updates.modelConfig.systemPrompt;
        }
        if (updates.themeColor !== undefined) config.themeColor = updates.themeColor;
        if (updates.activeModelSlot !== undefined) config.activeModelSlot = updates.activeModelSlot;
        if (updates.modelConfig2 !== undefined) config.modelConfig2 = updates.modelConfig2;
        if (updates.modelConfig3 !== undefined) config.modelConfig3 = updates.modelConfig3;
        if (updates.budgetUsd !== undefined) config.budgetUsd = updates.budgetUsd;
        if (updates.capabilities !== undefined) config.skills = updates.capabilities;
        if (updates.skills !== undefined) config.skills = updates.skills;
        if (updates.workflows !== undefined) config.workflows = updates.workflows;

        if (Object.keys(config).length > 0) {
            await OpenClawService.updateAgent(agentId, config);
        }
    } catch (e) {
        console.error('⚠️ [AgentService] Backend sync failed:', e);
        // We don't re-throw here to prevent UI lockup if the backend is flaky, 
        // as local overrides still work.
    }
};

/**
 * Returns the static mock agents synchronously (for initial render).
 * Use `loadAgents()` for the async version that checks OpenClaw first.
 */
export const getMockAgents = (): Agent[] => mockAgents;
