import { useReducer, useMemo, useEffect } from 'react';
import { X, Save, Pause, Play, Send, Sliders, ChevronDown } from 'lucide-react';
import { OpenClawService } from '../services/openclawService';
import { EventBus } from '../services/eventBus';
import { useProviderStore } from '../services/providerStore';
import { useRoleStore } from '../services/roleStore';
import { useCapabilitiesStore } from '../services/capabilitiesStore';
import type { Agent } from '../types';

// Master lists calculation moved into component using useMemo

/**
 * Props for the AgentConfigPanel component.
 */
interface AgentConfigPanelProps {
    /** The agent object to configure */
    agent: Agent;
    /** Callback to close the panel */
    onClose: () => void;
    /** Callback to update agent data in the parent state */
    onUpdate: (agentId: string, updates: Partial<Agent>) => void;
    /** Optional: Whether this is a new agent being created */
    isNew?: boolean;
}

// --- Reducer Types & Logic ---

interface ModelSlotConfig {
    provider: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    skills: string[];
    workflows: string[];
}

interface AgentConfigState {
    activeTab: 'primary' | 'secondary' | 'tertiary';
    identity: {
        name: string;
        role: string;
    };
    slots: {
        primary: ModelSlotConfig;
        secondary: ModelSlotConfig;
        tertiary: ModelSlotConfig;
    };
    governance: {
        budgetUsd: number;
    };
    ui: {
        directMessage: string;
        saving: boolean;
        themeColor: string;
        newRoleName: string;
        showPromote: boolean;
    };
}

type Action =
    | { type: 'SET_TAB'; payload: 'primary' | 'secondary' | 'tertiary' }
    | { type: 'UPDATE_IDENTITY'; field: 'name' | 'role'; value: string }
    | { type: 'UPDATE_SLOT'; slot: 'primary' | 'secondary' | 'tertiary'; field: 'model' | 'provider' | 'systemPrompt'; value: string }
    | { type: 'UPDATE_SLOT'; slot: 'primary' | 'secondary' | 'tertiary'; field: 'temperature'; value: number }
    | { type: 'UPDATE_SLOT'; slot: 'primary' | 'secondary' | 'tertiary'; field: 'skills' | 'workflows'; value: string[] }
    | { type: 'TOGGLE_CAPABILITY'; slot: 'primary' | 'secondary' | 'tertiary'; kind: 'skills' | 'workflows'; value: string }
    | { type: 'RESET_ROLE'; role: string }
    | { type: 'UPDATE_GOVERNANCE'; field: 'budgetUsd'; value: number }
    | { type: 'SET_UI'; field: 'directMessage' | 'saving' | 'themeColor' | 'newRoleName' | 'showPromote'; value: string | boolean };

function configReducer(state: AgentConfigState, action: Action): AgentConfigState {
    switch (action.type) {
        case 'SET_TAB':
            return { ...state, activeTab: action.payload };
        case 'UPDATE_IDENTITY':
            return {
                ...state,
                identity: { ...state.identity, [action.field]: action.value }
            };
        case 'UPDATE_SLOT':
            return {
                ...state,
                slots: {
                    ...state.slots,
                    [action.slot]: {
                        ...state.slots[action.slot],
                        [action.field]: action.value
                    }
                }
            };
        case 'TOGGLE_CAPABILITY': {
            const currentList = state.slots[action.slot][action.kind];
            const newList = currentList.includes(action.value)
                ? currentList.filter(item => item !== action.value)
                : [...currentList, action.value];
            return {
                ...state,
                slots: {
                    ...state.slots,
                    [action.slot]: {
                        ...state.slots[action.slot],
                        [action.kind]: newList
                    }
                }
            };
        }
        case 'RESET_ROLE': {
            const defaults = useRoleStore.getState().roles[action.role] || { capabilities: [], workflows: [] };
            return {
                ...state,
                identity: { ...state.identity, role: action.role },
                slots: {
                    ...state.slots,
                    primary: { ...state.slots.primary, skills: defaults.capabilities, workflows: defaults.workflows },
                    secondary: { ...state.slots.secondary, skills: [], workflows: [] },
                    tertiary: { ...state.slots.tertiary, skills: [], workflows: [] }
                }
            };
        }
        case 'SET_UI':
            return {
                ...state,
                ui: { ...state.ui, [action.field]: action.value }
            };
        case 'UPDATE_GOVERNANCE':
            return {
                ...state,
                governance: { ...state.governance, [action.field]: action.value }
            };
        default:
            return state;
    }
}

/**
 * AgentConfigPanel
 * 
 * A high-fidelity, slide-out configuration interface for managing the neural
 * state of a specific AI agent node. 
 *
 * Features:
 * - Multi-slot provider/model selection (Primary, Secondary, Tertiary).
 * - Real-time system prompt and temperature adjustments.
 * - Dynamic Skill/Workflow management with blueprint "Promotion" capabilities.
 * - Persistent direct messaging for out-of-band communication with the node.
 *
 * @param props - Component properties including the agent instance and update callbacks.
 */
export default function AgentConfigPanel({ agent, onClose, onUpdate, isNew = false }: AgentConfigPanelProps) {
    const [state, dispatch] = useReducer(configReducer, {
        activeTab: 'primary',
        identity: {
            name: agent.name,
            role: agent.role
        },
        slots: {
            primary: {
                provider: OpenClawService.resolveProvider(agent.model),
                model: agent.model,
                temperature: agent.modelConfig?.temperature ?? 0.7,
                systemPrompt: agent.modelConfig?.systemPrompt ?? '',
                skills: agent.modelConfig?.skills ?? agent.capabilities ?? [],
                workflows: agent.modelConfig?.workflows ?? agent.workflows ?? []
            },
            secondary: {
                provider: OpenClawService.resolveProvider(agent.model2 ?? 'Claude Opus 4.5'),
                model: agent.model2 ?? 'Claude Opus 4.5',
                temperature: agent.modelConfig2?.temperature ?? 0.5,
                systemPrompt: agent.modelConfig2?.systemPrompt ?? '',
                skills: agent.modelConfig2?.skills ?? [],
                workflows: agent.modelConfig2?.workflows ?? []
            },
            tertiary: {
                provider: OpenClawService.resolveProvider(agent.model3 ?? 'LLaMA 4 Maverick'),
                model: agent.model3 ?? 'LLaMA 4 Maverick',
                temperature: agent.modelConfig3?.temperature ?? 0.9,
                systemPrompt: agent.modelConfig3?.systemPrompt ?? '',
                skills: agent.modelConfig3?.skills ?? [],
                workflows: agent.modelConfig3?.workflows ?? []
            }
        },
        ui: {
            directMessage: '',
            saving: false,
            themeColor: agent.themeColor || '#10b981',
            newRoleName: '',
            showPromote: false
        },
        governance: {
            budgetUsd: agent.budgetUsd || 0
        }
    });

    const roles = useRoleStore(s => s.roles);
    const availableRoles = useMemo(() => Object.keys(roles).sort(), [roles]);

    // Connect to global capabilities store
    const { skills, workflows, fetchCapabilities } = useCapabilitiesStore();

    useEffect(() => {
        fetchCapabilities();
    }, [fetchCapabilities]);

    const allSkills = useMemo(() => skills.map((s: { name: string }) => s.name), [skills]);
    const allWorkflows = useMemo(() => workflows.map((w: { name: string }) => w.name), [workflows]);

    const addRole = useRoleStore(s => s.addRole);

    const { activeTab, identity, slots, ui, governance } = state;
    const currentSlot = slots[activeTab];

    const providers = useProviderStore(s => s.providers);
    const sortedProviders = useMemo(() =>
        [...providers].sort((a, b) => a.name.localeCompare(b.name)),
        [providers]);

    const allModels = useProviderStore(s => s.models);
    const filteredModels = useMemo(() =>
        allModels.filter(m => m.provider === currentSlot.provider)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [allModels, currentSlot.provider]);

    const handleRoleChange = (newRole: string) => {
        dispatch({ type: 'RESET_ROLE', role: newRole });
    };

    const handleProviderChange = (val: string) => {
        dispatch({ type: 'UPDATE_SLOT', slot: activeTab, field: 'provider', value: val });
        // Auto-select first model from this provider
        const firstModel = useProviderStore.getState().models.find(m => m.provider === val);
        if (firstModel) {
            dispatch({ type: 'UPDATE_SLOT', slot: activeTab, field: 'model', value: firstModel.name });
        }
    };

    const handleModelChange = (val: string) => {
        dispatch({ type: 'UPDATE_SLOT', slot: activeTab, field: 'model', value: val });
    };

    const handleTempChange = (val: number) => {
        dispatch({ type: 'UPDATE_SLOT', slot: activeTab, field: 'temperature', value: val });
    };

    const handlePromptChange = (val: string) => {
        dispatch({ type: 'UPDATE_SLOT', slot: activeTab, field: 'systemPrompt', value: val });
    };

    /**
     * Creates a new agent in the global Rust registry.
     * This endpoint handles persistence to agents.json and initiates WS broadcasts.
     * 
     * @param agent - The agent instance to serialize and persist.
     * @returns Promise<boolean> success status.
     */
    const handleSave = async () => {
        dispatch({ type: 'SET_UI', field: 'saving', value: true });

        try {
            const updates: Partial<Agent> & { provider?: string; provider2?: string; provider3?: string } = {
                role: identity.role,
                name: identity.name,
                budgetUsd: governance.budgetUsd
            };

            // Helper to construct model config updates
            const buildConfig = (slotKey: keyof typeof slots) => {
                const slot = slots[slotKey];
                return {
                    modelId: slot.model,
                    provider: slot.provider,
                    temperature: slot.temperature,
                    systemPrompt: slot.systemPrompt,
                    skills: slot.skills,
                    workflows: slot.workflows
                };
            };

            updates.model = slots.primary.model;
            updates.provider = slots.primary.provider;
            updates.modelConfig = buildConfig('primary');

            updates.model2 = slots.secondary.model;
            // provider2 etc aren't in Agent yet but passed in body
            updates.modelConfig2 = buildConfig('secondary');

            updates.model3 = slots.tertiary.model;
            updates.modelConfig3 = buildConfig('tertiary');

            updates.capabilities = [...new Set([...slots.primary.skills, ...slots.secondary.skills, ...slots.tertiary.skills])];
            updates.workflows = [...new Set([...slots.primary.workflows, ...slots.secondary.workflows, ...slots.tertiary.workflows])];
            updates.themeColor = ui.themeColor;
            updates.budgetUsd = governance.budgetUsd;
            updates.name = identity.name;
            updates.role = identity.role;

            onUpdate(agent.id, updates);
            onClose();

            EventBus.emit({
                source: 'System',
                text: `Agent ${identity.name} configuration updated.`,
                severity: 'success'
            });

            setTimeout(onClose, 800);
        } catch (error) {
            console.error('[ConfigPanel] Save Failed:', error);
            EventBus.emit({
                source: 'System',
                text: `Save Failed: Neural sector timeout or network error.`,
                severity: 'error'
            });
        } finally {
            dispatch({ type: 'SET_UI', field: 'saving', value: false });
        }
    };

    const handlePause = async () => {
        const success = await OpenClawService.pauseAgent(agent.id);
        onUpdate(agent.id, { status: 'idle' });
        EventBus.emit({ source: 'System', text: success ? `Agent ${identity.name} paused.` : `Agent ${identity.name} blocked locally.`, severity: 'info' });
    };

    const handleResume = async () => {
        const success = await OpenClawService.resumeAgent(agent.id);
        onUpdate(agent.id, { status: 'active' });
        EventBus.emit({ source: 'System', text: success ? `Agent ${identity.name} resumed.` : `Agent ${identity.name} resumed locally.`, severity: 'success' });
    };

    const handleSendMessage = async () => {
        if (!ui.directMessage.trim()) return;
        await OpenClawService.sendCommand(agent.id, ui.directMessage);
        EventBus.emit({ source: 'User', text: `→ ${identity.name}: ${ui.directMessage}`, severity: 'info' });
        dispatch({ type: 'SET_UI', field: 'directMessage', value: '' });
    };

    const handlePromote = () => {
        if (!ui.newRoleName.trim()) {
            EventBus.emit({ text: 'Please enter a name for the new role.', severity: 'warning', source: 'System' });
            return;
        }

        addRole(ui.newRoleName, {
            capabilities: currentSlot.skills,
            workflows: currentSlot.workflows
        });

        EventBus.emit({
            text: `Blueprint "${ui.newRoleName}" saved to system library.`,
            severity: 'success',
            source: 'System'
        });

        dispatch({ type: 'RESET_ROLE', role: ui.newRoleName });
        dispatch({ type: 'SET_UI', field: 'showPromote', value: false });
        dispatch({ type: 'SET_UI', field: 'newRoleName', value: '' });
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-start justify-between shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                    <div className="flex items-start gap-4 z-10">
                        <div className="relative group/picker">
                            <div
                                className="p-3 rounded-xl border transition-all duration-300 relative overflow-hidden"
                                style={{
                                    backgroundColor: `${ui.themeColor}15`,
                                    borderColor: `${ui.themeColor}40`,
                                    boxShadow: `0 0 20px ${ui.themeColor}10`
                                }}
                            >
                                <Sliders size={20} style={{ color: ui.themeColor }} />
                                <input
                                    type="color"
                                    value={ui.themeColor}
                                    onChange={(e) => dispatch({ type: 'SET_UI', field: 'themeColor', value: e.target.value })}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    title="Custom Agent Theme"
                                />
                            </div>
                            {/* Visual Indicator of HEX */}
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black/50 shadow-sm" style={{ backgroundColor: ui.themeColor }} />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-[11px] font-bold text-emerald-500 tracking-[0.2em] uppercase opacity-80">
                                {isNew ? 'New Node Initialization' : 'Neural Node Configuration'}
                            </h2>
                            <input
                                value={identity.name}
                                onChange={(e) => dispatch({ type: 'UPDATE_IDENTITY', field: 'name', value: e.target.value })}
                                className="bg-transparent border-none p-0 font-bold text-zinc-100 text-xl leading-tight focus:ring-0 w-full hover:bg-white/5 rounded px-1 -ml-1 transition-colors"
                                spellCheck={false}
                            />
                            <div className="flex items-center gap-3 pt-1">
                                <div className="relative group/role">
                                    <select
                                        value={identity.role}
                                        onChange={(e) => handleRoleChange(e.target.value)}
                                        className="appearance-none bg-zinc-900/80 border border-zinc-700/50 rounded px-2 py-0.5 text-xs font-bold text-zinc-300 uppercase tracking-widest cursor-pointer hover:border-emerald-500/50 hover:text-emerald-400 transition-all focus:outline-none pr-6"
                                    >
                                        {availableRoles.map(r => (
                                            <option key={r} value={r} className="bg-zinc-900">{r.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 group-hover/role:text-emerald-400 pointer-events-none" />
                                </div>
                                <span className="text-[11px] text-zinc-500 font-mono tracking-tighter opacity-50">
                                    ID_{agent.id.substring(0, 8).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white z-10">
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-zinc-800 bg-[#121215]">
                    {(['primary', 'secondary', 'tertiary'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => dispatch({ type: 'SET_TAB', payload: tab })}
                            className={`flex-1 py-3 text-xs uppercase font-bold tracking-wider transition-colors relative ${activeTab === tab ? 'text-zinc-100 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                        >
                            {tab}
                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    <div className="px-4 py-2 border-l-2 border-emerald-500/30 bg-emerald-500/5 rounded-r-lg">
                        <p className="text-[11px] text-emerald-500/70 leading-relaxed italic">
                            Node personality and core capabilities are derived from the active system role selected in the header.
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                            <span className="text-xs text-zinc-400 font-mono uppercase">{agent.status}</span>
                        </div>
                        <div className="flex gap-2">
                            {agent.status === 'active' ? (
                                <button onClick={handlePause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-bold hover:bg-yellow-500/20">
                                    <Pause size={12} /> Pause
                                </button>
                            ) : (
                                <button onClick={handleResume} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20">
                                    <Play size={12} /> Resume
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-5 animate-in fade-in duration-300" key={activeTab}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Provider ({activeTab})</label>
                                <select
                                    value={currentSlot.provider}
                                    onChange={(e) => handleProviderChange(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer font-bold appearance-none"
                                >
                                    {sortedProviders.map(p => (
                                        <option key={p.id} value={p.id} className="bg-zinc-950">
                                            {p.name.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Model Node</label>
                                <select
                                    value={currentSlot.model}
                                    onChange={(e) => handleModelChange(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono cursor-pointer appearance-none"
                                >
                                    {filteredModels.map(m => (
                                        <option key={m.id} value={m.name} className="bg-zinc-950">
                                            [{m.modality?.toUpperCase() || 'LLM'}] {m.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                                Temperature <span className="text-blue-400 font-mono">{currentSlot.temperature.toFixed(2)}</span>
                            </label>
                            <input type="range" min="0" max="2" step="0.05" value={currentSlot.temperature} onChange={(e) => handleTempChange(parseFloat(e.target.value))} className="w-full accent-blue-500" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">System Prompt ({activeTab})</label>
                            <textarea
                                value={currentSlot.systemPrompt}
                                onChange={(e) => handlePromptChange(e.target.value)}
                                rows={6}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono resize-none custom-scrollbar"
                            />
                        </div>

                        <div className="pt-4 border-t border-zinc-800/50">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Fiscal Governance</label>
                                <div className="text-[10px] font-mono text-zinc-400">
                                    Current Spend: <span className="text-emerald-400">${agent.costUsd?.toFixed(4) || '0.0000'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                                <div className="flex-1 space-y-1">
                                    <span className="text-[11px] text-zinc-500 uppercase font-bold tracking-tighter">Budget Limit (USD)</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-500 font-mono text-xs">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={governance.budgetUsd}
                                            onChange={(e) => dispatch({ type: 'UPDATE_GOVERNANCE', field: 'budgetUsd', value: parseFloat(e.target.value) || 0 })}
                                            className="bg-transparent border-none p-0 text-sm font-bold text-zinc-100 focus:ring-0 w-full"
                                        />
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-zinc-800" />
                                <div className="flex-1 space-y-1">
                                    <span className="text-[11px] text-zinc-500 uppercase font-bold tracking-tighter">Status</span>
                                    <div className="flex items-center gap-1.5">
                                        {(agent.costUsd || 0) >= (governance.budgetUsd || 0) && (governance.budgetUsd || 0) > 0 ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_red]" />
                                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">BREACHED</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_emerald]" />
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">NOMINAL</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                            <div className="flex flex-col h-48">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Skills ({currentSlot.skills.length})</label>
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg bg-zinc-900/30 p-2 space-y-1">
                                    {allSkills.map(skill => (
                                        <button
                                            key={skill}
                                            onClick={() => dispatch({ type: 'TOGGLE_CAPABILITY', slot: activeTab, kind: 'skills', value: skill as string })}
                                            className={`w-full flex items-center gap-2 p-1.5 rounded text-xs transition-colors ${currentSlot.skills.includes(skill as string) ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full border ${currentSlot.skills.includes(skill as string) ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}`} />
                                            {skill}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col h-48">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Workflows ({currentSlot.workflows.length})</label>
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg bg-zinc-900/30 p-2 space-y-1">
                                    {allWorkflows.map(wf => (
                                        <button
                                            key={wf}
                                            onClick={() => dispatch({ type: 'TOGGLE_CAPABILITY', slot: activeTab, kind: 'workflows', value: wf as string })}
                                            className={`w-full flex items-center gap-2 p-1.5 rounded text-xs transition-colors ${currentSlot.workflows.includes(wf as string) ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full border ${currentSlot.workflows.includes(wf as string) ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`} />
                                            {wf}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Inject Message</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={ui.directMessage}
                                onChange={(e) => dispatch({ type: 'SET_UI', field: 'directMessage', value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Send instruction..."
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                            />
                            <button onClick={handleSendMessage} className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Send size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50 pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                Role Blueprint Deployment
                            </label>
                            <button
                                onClick={() => dispatch({ type: 'SET_UI', field: 'showPromote', value: !ui.showPromote })}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase"
                            >
                                {ui.showPromote ? 'Cancel' : 'Promote to Role'}
                            </button>
                        </div>

                        {ui.showPromote ? (
                            <div className="space-y-3 bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl animate-in zoom-in-95 duration-200">
                                <p className="text-[10px] text-blue-400/80 leading-tight">
                                    Promoting this configuration will create a new system-level role with these selected skills and workflows.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={ui.newRoleName}
                                        onChange={(e) => dispatch({ type: 'SET_UI', field: 'newRoleName', value: e.target.value })}
                                        placeholder="Enter new role name (e.g. Lead Dev)..."
                                        className="flex-1 bg-black/40 border border-blue-500/30 rounded-lg px-3 py-2 text-xs text-blue-100 focus:outline-none focus:border-blue-400 placeholder:text-blue-900/50"
                                    />
                                    <button
                                        onClick={handlePromote}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all"
                                    >
                                        PROMOTE
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[9px] text-zinc-600 italic">
                                Use "Promote to Role" to save this manual configuration as a reusable system blueprint.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
                    <button onClick={handleSave} disabled={ui.saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50">
                        <Save size={14} />
                        {ui.saving ? 'Saving...' : (isNew ? 'Create Agent' : 'Save Configuration')}
                    </button>
                </div>
            </div>
        </div>
    );
}
