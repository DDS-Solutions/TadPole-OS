/**
 * @module providerStore
 * Secure state management for AI providers and model inventory.
 * 
 * DESIGN PATTERN: NeuralVault (Client-Side Encryption)
 * - API keys are encrypted using AES-256-GCM with a user-defined Master Key.
 * - Decrypted keys exist ONLY in memory (Zustand state) and are never persisted to disk.
 * - Locking/Unlocking clears or restores the session-level decryption capability.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encrypt, decrypt } from '../utils/crypto';
import { MODEL_OPTIONS } from '../data/models';
import { PROVIDERS } from '../constants';

function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    modality: 'llm' | 'vision' | 'voice' | 'reasoning' | string;
    rpm?: number;
    rpd?: number;
    tpm?: number;
    tpd?: number;
}

export interface ProviderConfig {
    id: string; // 'openai', 'anthropic', etc.
    name: string;
    icon?: string;
    apiKey?: string; // Encrypted string
    baseUrl?: string;
    externalId?: string; // Provider identity for ToS/Tracking
    protocol?: 'openai' | 'anthropic' | 'google' | 'ollama' | 'deepseek';
    customHeaders?: Record<string, string>;
    audioModel?: string;
}

interface ProviderState {
    isLocked: boolean;
    masterKey: string | null;
    encryptedConfigs: Record<string, string>; // providerId -> encryptedJson
    baseUrls: Record<string, string>; // providerId -> plaintext url
    providers: ProviderConfig[];
    models: ModelEntry[];
    inactivityTimeout: number; // in ms

    // Actions
    unlock: (password: string) => Promise<boolean>;
    lock: () => void;
    addProvider: (name: string, icon: string) => void;
    editProvider: (id: string, name: string, icon: string) => void;
    deleteProvider: (id: string) => void;
    setProviderConfig: (id: string, apiKey: string, baseUrl?: string, externalId?: string, protocol?: ProviderConfig['protocol'], customHeaders?: Record<string, string>, audioModel?: string) => Promise<void>;
    getApiKey: (providerId: string) => Promise<string | null>;
    resetInactivityTimer: () => void;

    // Model CRUD
    addModel: (name: string, provider: string, modality?: ModelEntry['modality'], limits?: Partial<Pick<ModelEntry, 'rpm' | 'rpd' | 'tpm' | 'tpd'>>) => void;
    editModel: (id: string, name: string, provider: string, modality: ModelEntry['modality'], limits?: Partial<Pick<ModelEntry, 'rpm' | 'rpd' | 'tpm' | 'tpd'>>) => void;
    deleteModel: (id: string) => void;
    syncDefaults: () => void;
}

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const DEFAULT_PROVIDERS: ProviderConfig[] = [
    { id: PROVIDERS.OPENAI, name: 'OpenAI', icon: '⚡' },
    { id: PROVIDERS.ANTHROPIC, name: 'Anthropic', icon: '🏺' },
    { id: PROVIDERS.GOOGLE, name: 'Google Vertex', icon: '☁️' },
    { id: PROVIDERS.GROQ, name: 'Groq', icon: '⚡' },
    { id: PROVIDERS.OLLAMA, name: 'Ollama', icon: '🦙' }, // Assuming OLLAMA maps to 'meta/llama' contextually or is distinct
    { id: 'meta', name: 'Meta / Llama', icon: '🦙' }, // Keeping meta separate if not in PROVIDERS yet, or map to OLLAMA/LOCAL
    { id: PROVIDERS.LOCAL, name: 'Local Infrastructure', icon: '🏠' },
];

// Initial models from static list
const INITIAL_MODELS: ModelEntry[] = MODEL_OPTIONS.map(m => {
    let provider: string = PROVIDERS.LOCAL;
    let modality: ModelEntry['modality'] = 'llm';
    const lower = m.toLowerCase();

    if (lower.includes('gpt') || lower.includes('o4')) provider = PROVIDERS.OPENAI;
    else if (lower.includes('claude')) provider = PROVIDERS.ANTHROPIC;
    else if (lower.includes('gemini')) provider = PROVIDERS.GOOGLE;
    else if (lower.includes('llama')) {
        if (lower.includes('groq') || lower.includes('versatile') || lower.includes('instant')) provider = PROVIDERS.GROQ;
        else provider = 'meta';
    }
    else if (lower.includes('grok')) provider = 'xai';
    else if (lower.includes('groq')) provider = PROVIDERS.GROQ;

    // Heuristic for modality
    if (lower.includes('vision') || lower.includes('flash') || lower.includes('pro')) modality = 'vision';
    if (lower.includes('audio') || lower.includes('voice') || lower.includes('tts')) modality = 'voice';
    if (lower.includes('coder') || lower.includes('reasoning') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4') || lower.includes('r1') || lower.includes('thought')) modality = 'reasoning';

    return { id: generateId(), name: m, provider, modality };
});

export const useProviderStore = create<ProviderState>()(
    persist(
        (set, get) => ({
            isLocked: true,
            masterKey: null,
            encryptedConfigs: {},
            baseUrls: {},
            providers: DEFAULT_PROVIDERS,
            models: INITIAL_MODELS,
            inactivityTimeout: DEFAULT_TIMEOUT,

            resetInactivityTimer: () => {
                if (autoLockTimer) clearTimeout(autoLockTimer);
                if (get().isLocked) return;

                autoLockTimer = setTimeout(() => {
                    console.log('[NeuralVault] Auto-locking due to inactivity.');
                    get().lock();
                }, get().inactivityTimeout);
            },

            unlock: async (password: string) => {
                const configs = get().encryptedConfigs;
                const firstKey = Object.keys(configs)[0];

                if (firstKey) {
                    try {
                        await decrypt(configs[firstKey], password);
                    } catch (_e) {
                        return false;
                    }
                }

                set({ isLocked: false, masterKey: password });
                get().resetInactivityTimer();
                return true;
            },

            lock: () => {
                if (autoLockTimer) clearTimeout(autoLockTimer);
                set({ isLocked: true, masterKey: null });
            },

            addProvider: (name, icon) => {
                const { providers } = get();
                if (providers.length >= 25) {
                    throw new Error('Neural Infrastructure Capacity Reached: Maximum of 25 nodes allowed.');
                }
                const id = name.toLowerCase().replace(/\s+/g, '-');
                set(state => ({
                    providers: [...state.providers, { id, name, icon }]
                }));
            },

            editProvider: (id, name, icon) => set(state => ({
                providers: state.providers.map(p => p.id === id ? { ...p, name, icon } : p)
            })),

            deleteProvider: (id) => set(state => ({
                providers: state.providers.filter(p => p.id !== id),
                models: state.models.filter(m => m.provider !== id)
            })),

            setProviderConfig: async (id, apiKey, baseUrl, externalId, protocol, customHeaders, audioModel) => {
                const { masterKey, encryptedConfigs, baseUrls, providers } = get();
                if (!masterKey) throw new Error('Store is locked');

                const encrypted = await encrypt(apiKey, masterKey);
                set({
                    encryptedConfigs: { ...encryptedConfigs, [id]: encrypted },
                    baseUrls: { ...baseUrls, [id]: baseUrl || '' },
                    providers: providers.map(p => p.id === id ? { ...p, externalId, protocol, customHeaders, audioModel } : p)
                });
                get().resetInactivityTimer();
            },

            getApiKey: async (providerId) => {
                const { masterKey, encryptedConfigs } = get();
                if (!masterKey) return null;

                const encrypted = encryptedConfigs[providerId];
                if (!encrypted) return null;

                try {
                    const decrypted = await decrypt(encrypted, masterKey);
                    get().resetInactivityTimer();
                    return decrypted;
                } catch {
                    return null;
                }
            },

            addModel: (name, provider, modality = 'llm', limits) => set(state => ({
                models: [...state.models, {
                    id: generateId(),
                    name,
                    provider,
                    modality,
                    rpm: limits?.rpm ?? 10,
                    tpm: limits?.tpm ?? 100000,
                    rpd: limits?.rpd ?? 1000,
                    tpd: limits?.tpd ?? 10000000
                }]
            })),

            editModel: (id: string, name: string, provider: string, modality: ModelEntry['modality'], limits: any) => set(state => ({
                models: state.models.map(m => m.id === id ? { ...m, name, provider, modality, ...limits } : m)
            })),

            deleteModel: (id) => set(state => ({
                models: state.models.filter(m => m.id !== id)
            })),

            syncDefaults: () => {
                const { providers, models } = get();
                const missingProviders = DEFAULT_PROVIDERS.filter(dp => !providers.find(p => p.id === dp.id));

                if (missingProviders.length > 0) {
                    console.log('[NeuralVault] Syncing missing default providers:', missingProviders.map(p => p.name));
                    set(state => ({
                        providers: [...state.providers, ...missingProviders]
                    }));
                }

                // Also ensure core models from the heuristic are present if they contain essential keywords
                // This helps fix "wires crossed" for legacy model entries
                const updatedModels = models.map(m => {
                    const lower = m.name.toLowerCase();
                    let newProvider = m.provider;
                    if (lower.includes('claude')) newProvider = PROVIDERS.ANTHROPIC;
                    else if (lower.includes('gemini')) newProvider = PROVIDERS.GOOGLE;
                    else if (lower.includes('llama') && (lower.includes('groq') || lower.includes('versatile'))) newProvider = PROVIDERS.GROQ;

                    if (newProvider !== m.provider) {
                        console.log(`[NeuralVault] Auto-fixing provider for model ${m.name}: ${m.provider} -> ${newProvider}`);
                        return { ...m, provider: newProvider };
                    }
                    return m;
                });

                if (JSON.stringify(updatedModels) !== JSON.stringify(models)) {
                    set({ models: updatedModels });
                }
            }
        }),
        {
            name: 'tadpole-vault-v2',
            partialize: (state) => ({
                encryptedConfigs: state.encryptedConfigs,
                baseUrls: state.baseUrls,
                providers: state.providers,
                models: state.models
            }),
        }
    )
);
