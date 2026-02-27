import { create } from 'zustand';
import type { Agent } from '../types';
import { loadAgents, persistAgentUpdate } from './agentService';

interface AgentState {
    agents: Agent[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchAgents: () => Promise<void>;
    updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
    /**
     * Registers a new agent node in the cluster and triggers backend persistence.
     * 
     * @param agent - The complete agent object to register.
     */
    addAgent: (agent: Agent) => Promise<void>;
    /**
     * Retrieves a specific agent by ID from the current state.
     */
    getAgent: (id: string) => Agent | undefined;
}

/**
 * useAgentStore
 * Standardized reactive store for the entire agent swarm.
 * Ensures consistent themeColor and state propagation across all views.
 */
export const useAgentStore = create<AgentState>((set, get) => ({
    agents: [],
    isLoading: false,
    error: null,

    fetchAgents: async () => {
        set({ isLoading: true, error: null });
        try {
            const agents = await loadAgents();
            set({ agents, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    updateAgent: async (id, updates) => {
        // 1. Optimistic Update
        set(state => ({
            agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a)
        }));

        // 2. Persist to Backend & LocalStorage
        try {
            await persistAgentUpdate(id, updates);
        } catch (err: any) {
            console.error('Failed to persist agent update:', err);
            // Revert on failure (simple refetch for consistency)
            const agents = await loadAgents();
            set({ agents, error: err.message });
        }
    },

    addAgent: async (agent) => {
        set(state => ({
            agents: [...state.agents, agent]
        }));
        try {
            await persistAgentUpdate(agent.id, agent);
        } catch (err: any) {
            console.error('Failed to persist new agent:', err);
            const agents = await loadAgents();
            set({ agents, error: err.message });
        }
    },

    getAgent: (id) => get().agents.find(a => a.id === id)
}));
