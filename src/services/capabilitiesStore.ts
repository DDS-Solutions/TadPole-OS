import { create } from 'zustand';
import { getSettings } from './settingsStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SkillDefinition {
    name: string;
    description: string;
    execution_command: string;
    schema: Record<string, any>;
}

export interface WorkflowDefinition {
    name: string;
    content: string;
}

interface CapabilitiesState {
    skills: SkillDefinition[];
    workflows: WorkflowDefinition[];
    isLoading: boolean;
    error: string | null;
}

interface CapabilitiesActions {
    fetchCapabilities: () => Promise<void>;
    saveSkill: (skill: SkillDefinition) => Promise<void>;
    deleteSkill: (name: string) => Promise<void>;
    saveWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
    deleteWorkflow: (name: string) => Promise<void>;
}

export const useCapabilitiesStore = create<CapabilitiesState & CapabilitiesActions>()((set, get) => ({
    skills: [],
    workflows: [],
    isLoading: false,
    error: null,

    fetchCapabilities: async () => {
        set({ isLoading: true, error: null });
        try {
            const token = getSettings().openClawApiKey;
            const res = await fetch(`${API_BASE}/system/capabilities`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch capabilities');
            const data = await res.json();

            set({
                skills: data.skills.sort((a: SkillDefinition, b: SkillDefinition) => a.name.localeCompare(b.name)),
                workflows: data.workflows.sort((a: WorkflowDefinition, b: WorkflowDefinition) => a.name.localeCompare(b.name)),
                isLoading: false
            });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    saveSkill: async (skill) => {
        const token = getSettings().openClawApiKey;
        const res = await fetch(`${API_BASE}/system/skills/${skill.name}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(skill)
        });
        if (!res.ok) {
            let errorMsg = 'Failed to save skill';
            try {
                const data = await res.json();
                if (data.message) errorMsg = data.message;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        await get().fetchCapabilities();
    },

    deleteSkill: async (name) => {
        const token = getSettings().openClawApiKey;
        const res = await fetch(`${API_BASE}/system/skills/${name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            let errorMsg = 'Failed to delete skill';
            try {
                const data = await res.json();
                if (data.message) errorMsg = data.message;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        await get().fetchCapabilities();
    },

    saveWorkflow: async (workflow) => {
        const token = getSettings().openClawApiKey;
        const res = await fetch(`${API_BASE}/system/workflows/${workflow.name}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(workflow)
        });
        if (!res.ok) {
            let errorMsg = 'Failed to save workflow';
            try {
                const data = await res.json();
                if (data.message) errorMsg = data.message;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        await get().fetchCapabilities();
    },

    deleteWorkflow: async (name) => {
        const token = getSettings().openClawApiKey;
        const res = await fetch(`${API_BASE}/system/workflows/${name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            let errorMsg = 'Failed to delete workflow';
            try {
                const data = await res.json();
                if (data.message) errorMsg = data.message;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        await get().fetchCapabilities();
    }
}));
