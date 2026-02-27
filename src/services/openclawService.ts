/**
 * @module openclawService
 * HTTP client for the OpenClaw Rust backend.
 * Provides typed methods for agent management, command dispatch,
 * and mission synchronization. All requests use AbortController
 * with a configurable timeout.
 */
import type { Agent, AgentConfig, TaskPayload, AgentStatus, Mission } from '../types/index';
import type { OpenClawAgent } from '../types/openclaw';
import { getSettings } from './settingsStore';
import { PROVIDERS } from '../constants';
import { resolveTechnicalModelId } from '../utils/modelUtils';
import { loadAgents } from '../services/agentService';
import { useProviderStore } from '../services/providerStore';
import { EventBus } from '../services/eventBus';

/** Default request timeout in ms. Increased to 60s for extreme load conditions (cargo builds). */
const REQUEST_TIMEOUT = 60000;

/** Creates an AbortController with a timeout and returns signal + cleanup.
 *  The abort reason is set to 'TIMEOUT' so callers can distinguish
 *  timeout aborts from user-initiated or network aborts.
 */
function withTimeout(): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort('TIMEOUT'), REQUEST_TIMEOUT);
    return { signal: controller.signal, clear: () => clearTimeout(id) };
}

/**
 * Service for interacting with the OpenClaw (Tadpole OS Engine) backend.
 */
export const OpenClawService = {
    /**
     * Helper to get common headers including Authorization
     */
    getHeaders: () => {
        const { openClawApiKey } = getSettings();
        const token = openClawApiKey || 'tadpole-dev-token-2026';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    /**
     * Checks if the OpenClaw instance is reachable.
     */
    checkHealth: async (): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const response = await fetch(`${openClawUrl}/engine/health`, {
                method: 'GET',
                signal
            });

            clear();
            return response.ok;
        } catch {
            return false;
        }
    },

    /**
     * Fetches agents from OpenClaw.
     */
    getAgents: async (): Promise<Agent[]> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const response = await fetch(`${openClawUrl}/agents`, {
                method: 'GET',
                headers: OpenClawService.getHeaders(),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to fetch agents`);
            }

            const data: OpenClawAgent[] = await response.json();

            return data.map(oa => {
                const rawDept = oa.department || oa.metadata?.department || 'Operations';
                const dept = rawDept === 'QA' ? 'Quality Assurance' : rawDept;

                return {
                    id: oa.id,
                    name: oa.name,
                    role: oa.role || oa.metadata?.role || 'AI Agent',
                    department: dept as any,
                    status: (oa.status === 'working' ? 'active' : oa.status) as AgentStatus || 'idle',
                    tokensUsed: 0,
                    model: (typeof oa.model === 'string' ? oa.model : oa.modelConfig?.modelId) || 'Unknown',
                    modelConfig: oa.modelConfig,
                    workspacePath: oa.workspace,
                    currentTask: undefined,
                    capabilities: oa.skills || [],
                    workflows: [],
                    themeColor: oa.themeColor,
                    budgetUsd: oa.budgetUsd || 0,
                    costUsd: oa.costUsd || 0,
                    model2: oa.model2,
                    model3: oa.model3,
                    modelConfig2: oa.modelConfig2,
                    modelConfig3: oa.modelConfig3,
                    activeModelSlot: oa.activeModelSlot as 1 | 2 | 3,
                };
            });

        } catch (error) {
            console.error('OpenClaw Fetch Error:', error);
            throw error; // Bubble up for store to handle
        }
    },

    /**
     * Updates an agent's configuration in the global Rust registry.
     * This ensures the change is persisted to disk and broadcast to all dashboards.
     */
    updateAgent: async (agentId: string, config: AgentConfig): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const body: any = {};
            if (config.name !== undefined) body.name = config.name;
            if (config.role !== undefined) body.role = config.role;
            if (config.modelId !== undefined) body.modelId = config.modelId;
            if (config.provider !== undefined) body.provider = config.provider;
            if (config.temperature !== undefined) body.temperature = config.temperature;
            if (config.themeColor !== undefined) body.themeColor = config.themeColor;
            if (config.budgetUsd !== undefined) body.budgetUsd = config.budgetUsd;
            if (config.skills !== undefined) body.skills = config.skills;
            if (config.workflows !== undefined) body.workflows = config.workflows;
            if (config.activeModelSlot !== undefined) body.activeModelSlot = config.activeModelSlot;

            // For slots, we use the specific config if provided
            if (config.modelConfig2 !== undefined) {
                body.model2 = config.modelConfig2.modelId;
                body.modelConfig2 = config.modelConfig2;
            }
            if (config.modelConfig3 !== undefined) {
                body.model3 = config.modelConfig3.modelId;
                body.modelConfig3 = config.modelConfig3;
            }

            // Align with Rust endpoint: PUT /agents/:id
            const response = await fetch(`${openClawUrl}/agents/${agentId}`, {
                method: 'PUT',
                headers: OpenClawService.getHeaders(),
                body: JSON.stringify(body),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to update agent`);
            }
            return true;
        } catch (error) {
            console.error('Engine Update Error:', error);
            throw error;
        }
    },

    /**
     * Creates a new agent in the global Rust registry.
     * This endpoint handles persistence to agents.json and initiates WS broadcasts.
     * 
     * @param agent - The agent instance to serialize and persist.
     * @returns Promise<boolean> success status.
     */
    createAgent: async (agent: Agent): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const body = {
                id: agent.id,
                name: agent.name,
                role: agent.role,
                department: agent.department,
                description: "New Agent Node",
                model_id: agent.model, // Mapped from Rust model_id
                model: agent.modelConfig, // Mapped from Rust model (full config)
                model2_id: agent.model2, // Mapped from Rust model2_id
                model3_id: agent.model3, // Mapped from Rust model3_id
                model2: agent.modelConfig2, // Mapped from Rust model2 (full config)
                model3: agent.modelConfig3, // Mapped from Rust model3 (full config)
                status: "idle",
                tokensUsed: 0,
                tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                metadata: { role: agent.role, department: agent.department },
                themeColor: agent.themeColor,
                budgetUsd: agent.budgetUsd || 0,
                costUsd: 0
            };

            const response = await fetch(`${openClawUrl}/agents`, {
                method: 'POST',
                headers: OpenClawService.getHeaders(),
                body: JSON.stringify(body),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to create agent`);
            }
            return true;
        } catch (error) {
            console.error('Engine Creation Error:', error);
            throw error;
        }
    },

    /**
     * Pauses a running agent.
     */
    pauseAgent: async (agentId: string): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const response = await fetch(`${openClawUrl}/agents/${agentId}/pause`, {
                method: 'POST',
                headers: OpenClawService.getHeaders(),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to pause agent`);
            }
            return true;
        } catch (error) {
            console.error('OpenClaw Pause Error:', error);
            throw error;
        }
    },

    /**
     * Resumes a paused agent.
     */
    resumeAgent: async (agentId: string): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const response = await fetch(`${openClawUrl}/agents/${agentId}/resume`, {
                method: 'POST',
                headers: OpenClawService.getHeaders(),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to resume agent`);
            }
            return true;
        } catch (error) {
            console.error('OpenClaw Resume Error:', error);
            throw error;
        }
    },

    /**
     * Robustly resolves a provider for a given model ID using keyword heuristics.
     */
    resolveProvider: (modelId: string): string => {
        const lower = modelId.toLowerCase();
        if (lower.includes('gpt') || lower.includes('o4')) return PROVIDERS.OPENAI;
        if (lower.includes('claude')) return PROVIDERS.ANTHROPIC;
        if (lower.includes('gemini')) return PROVIDERS.GOOGLE;
        if (lower.includes('llama')) {
            if (lower.includes('groq') || lower.includes('versatile') || lower.includes('instant') || lower.includes('specdec')) return PROVIDERS.GROQ;
            return 'meta'; // Not in standard enum yet
        }
        if (lower.includes('grok')) return 'xai';
        if (lower.includes('groq')) return PROVIDERS.GROQ;
        if (lower.includes('deepseek')) return 'deepseek';
        if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
        if (lower.includes('qwen')) return 'alibaba';
        return PROVIDERS.GOOGLE; // Default fallback
    },

    sendCommand: async (agentId: string, message: string, clusterId?: string, department?: string, overrideModelId?: string, overrideProvider?: string, budgetUsd?: number, externalId?: string, safeMode?: boolean): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();

            // Lookup provider and inject auth for the mission command
            const agents = await loadAgents();
            const agent = agents.find((a: any) => String(a.id) === String(agentId));

            if (!agent) {
                console.warn(`\u26A0\uFE0F [OpenClaw] Agent ${agentId} not found in local registry for command injection.`);
            }

            const technicalModelId = resolveTechnicalModelId(overrideModelId || agent?.modelConfig?.modelId || agent?.model || 'gemini-1.5-flash');
            let modelId = technicalModelId; // Force technical ID
            let provider = overrideProvider || agent?.modelConfig?.provider || OpenClawService.resolveProvider(modelId);

            // Handle multi-slot model switching if no explicit overrides provided
            if (!overrideModelId && !overrideProvider && agent?.activeModelSlot) {
                if (agent.activeModelSlot === 2 && agent.modelConfig2) {
                    modelId = resolveTechnicalModelId(agent.modelConfig2.modelId || agent.model2 || modelId);
                    provider = agent.modelConfig2.provider || OpenClawService.resolveProvider(modelId);
                } else if (agent.activeModelSlot === 3 && agent.modelConfig3) {
                    modelId = resolveTechnicalModelId(agent.modelConfig3.modelId || agent.model3 || modelId);
                    provider = agent.modelConfig3.provider || OpenClawService.resolveProvider(modelId);
                }
            }

            console.log(`\uD83D\uDCE1 [OpenClaw] Preparing mission for ${agent?.name || agentId} (Model: ${modelId}, Slot: ${agent?.activeModelSlot || 1})`);

            const store = useProviderStore.getState();

            const body: TaskPayload = { message, clusterId, department, provider, modelId, budgetUsd, externalId, safeMode };

            // Inject API Key if available
            const providerApiKey = await store.getApiKey(provider);
            if (providerApiKey) {
                console.log(`\uD83D\uDD11 [OpenClaw] SUCCESS: Injecting ${provider.toUpperCase()} key.`);
                body.apiKey = providerApiKey;

                // --- Inject Rate Limits from Model Inventory ---
                const inventoryModel = store.models.find(m => m.name === modelId);
                if (inventoryModel) {
                    if (inventoryModel.rpm) body.rpm = inventoryModel.rpm;
                    if (inventoryModel.tpm) body.tpm = inventoryModel.tpm;
                    if (inventoryModel.rpd) body.rpd = inventoryModel.rpd;
                    if (inventoryModel.tpd) body.tpd = inventoryModel.tpd;
                    console.log(`\u2696\uFE0F [OpenClaw] Governance: Applied configured limits for ${modelId}`);
                }
            } else {
                const reason = store.isLocked ? 'Vault is Locked' : 'No Key Configured';
                console.error(`\u274C [OpenClaw] FAILURE: ${reason} for provider ${provider}.`);

                // EventBus now statically imported at module level
                EventBus.emit({
                    source: 'System',
                    text: `\u274C Mission Blocked: ${reason} for ${provider.toUpperCase()}. Please unlock the Neural Vault.`,
                    severity: 'error'
                });
            }

            if (store.baseUrls[provider]) {
                body.baseUrl = store.baseUrls[provider];
            }

            // Setup timeout right before dispatch to avoid counting async setup time
            const { signal, clear } = withTimeout();

            // Align with Gateway.ts endpoint: /agents/:id/send
            const response = await fetch(`${openClawUrl}/agents/${agentId}/send`, {
                method: 'POST',
                headers: OpenClawService.getHeaders(),
                body: JSON.stringify(body),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to send command`);
            }
            return true;
        } catch (error) {
            console.error('OpenClaw Command Error:', error);
            throw error;
        }
    },

    /**
     * Synchronizes a mission to an agent's local workspace.
     */
    syncMission: async (agentId: string, mission: Mission): Promise<boolean> => {
        try {
            const { openClawUrl } = getSettings();
            const { signal, clear } = withTimeout();

            const response = await fetch(`${openClawUrl}/agents/${agentId}/mission`, {
                method: 'POST',
                headers: OpenClawService.getHeaders(),
                body: JSON.stringify(mission),
                signal
            });

            clear();
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP Error ${response.status}: Failed to sync mission`);
            }
            return true;
        } catch (error) {
            console.error('OpenClaw Mission Sync Error:', error);
            throw error;
        }
    },

    /**
     * Transcribes audio using the backend's high-fidelity Whisper engine.
     */
    transcribe: async (audioBlob: Blob): Promise<string> => {
        try {
            const { openClawUrl } = getSettings();
            const formData = new FormData();
            formData.append('file', audioBlob, 'speech.wav');

            const headers = { ...OpenClawService.getHeaders() };
            // multipart/form-data should not have a manual Content-Type set so the browser can add the boundary
            delete (headers as any)['Content-Type'];

            const response = await fetch(`${openClawUrl}/engine/transcribe`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!response.ok) throw new Error('Transcription failed');
            const data = await response.json();
            return data.text || '';
        } catch (error) {
            console.error('Transcription Error:', error);
            return '';
        }
    }
};
