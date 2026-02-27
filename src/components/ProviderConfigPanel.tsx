import { useState, useReducer, useMemo, useEffect } from 'react';
import { X, Save, Plus, Trash2, Edit2, Check, ShieldCheck, Globe, Key, Zap, Info, Cpu, Layers, Activity } from 'lucide-react';
import { useProviderStore, type ProviderConfig, type ModelEntry } from '../services/providerStore';
import { EventBus } from '../services/eventBus';
import { MODEL_OPTIONS } from '../data/models';

interface ProviderConfigPanelProps {
    /** The provider configuration to edit */
    provider: ProviderConfig;
    /** Callback to close the panel */
    onClose: () => void;
}

interface PanelState {
    name: string;
    icon: string;
    apiKey: string;
    baseUrl: string;
    externalId: string;
    protocol: ProviderConfig['protocol'];
    customHeaders: string; // JSON string
    audioModel: string;
    isTesting: boolean;
    testResult: 'idle' | 'success' | 'failed';
}

type Action =
    | { type: 'UPDATE_FIELD'; field: keyof PanelState; value: any };

function panelReducer(state: PanelState, action: Action): PanelState {
    switch (action.type) {
        case 'UPDATE_FIELD':
            return { ...state, [action.field]: action.value };
        default:
            return state;
    }
}

/**
 * ProviderConfigPanel
 * 
 * A high-fidelity administrative panel for configuring AI Providers and their associated models.
 * Features the "Model Forge" for real-time model catalog management.
 */
export default function ProviderConfigPanel({ provider, onClose }: ProviderConfigPanelProps) {
    const { setProviderConfig, editProvider, models, addModel, editModel, deleteModel } = useProviderStore();

    // Models for this provider directly from store
    const providerModels = useMemo(() =>
        models.filter(m => m.provider === provider.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [models, provider.id]
    );

    const [state, dispatch] = useReducer(panelReducer, {
        name: provider.name,
        icon: provider.icon || '⚡',
        apiKey: '', // Start empty for security
        baseUrl: provider.baseUrl || '',
        externalId: provider.externalId || '',
        protocol: provider.protocol || 'openai',
        customHeaders: JSON.stringify(provider.customHeaders || {}, null, 2),
        audioModel: provider.audioModel || '',
        isTesting: false,
        testResult: 'idle'
    });

    const [isForgeAdding, setIsForgeAdding] = useState(false);
    const [forgeNewModel, setForgeNewModel] = useState({
        name: '',
        modality: 'llm' as ModelEntry['modality'],
        rpm: 10,
        tpm: 100000,
        rpd: 1000,
        tpd: 10000000
    });
    const [isForgeCustomModality, setIsForgeCustomModality] = useState(false);
    const [forgeCustomModality, setForgeCustomModality] = useState('');
    const [editingModelId, setEditingModelId] = useState<string | null>(null);

    const handleSave = async () => {
        dispatch({ type: 'UPDATE_FIELD', field: 'isTesting', value: true });

        try {
            // 1. Update Provider Identity (Name/Icon)
            editProvider(provider.id, state.name, state.icon);

            // 2. Update Provider Config (Vault)
            let parsedHeaders = {};
            try {
                parsedHeaders = JSON.parse(state.customHeaders);
            } catch (e) {
                console.error('Invalid JSON headers');
            }

            await setProviderConfig(
                provider.id,
                state.apiKey,
                state.baseUrl,
                state.externalId,
                state.protocol,
                parsedHeaders,
                state.audioModel
            );

            EventBus.emit({
                source: 'System',
                text: `Provider ${state.name} infrastructure updated.`,
                severity: 'success'
            });

            onClose();
        } catch (error: any) {
            EventBus.emit({
                source: 'System',
                text: `Vault Error: ${error.message}`,
                severity: 'error'
            });
        } finally {
            dispatch({ type: 'UPDATE_FIELD', field: 'isTesting', value: false });
        }
    };

    const handleTestConnection = async () => {
        dispatch({ type: 'UPDATE_FIELD', field: 'isTesting', value: true });
        dispatch({ type: 'UPDATE_FIELD', field: 'testResult', value: 'idle' });

        // Simulate high-tech test
        setTimeout(() => {
            dispatch({ type: 'UPDATE_FIELD', field: 'isTesting', value: false });
            dispatch({ type: 'UPDATE_FIELD', field: 'testResult', value: 'success' });
            EventBus.emit({
                source: 'System',
                text: `Sync Trace Successful: ${state.name} endpoint reactive.`,
                severity: 'success'
            });
        }, 1200);
    };

    const handleForgeAdd = () => {
        if (!forgeNewModel.name.trim()) return;
        const finalModality = isForgeCustomModality ? forgeCustomModality : forgeNewModel.modality;
        addModel(forgeNewModel.name, provider.id, finalModality, {
            rpm: forgeNewModel.rpm,
            tpm: forgeNewModel.tpm,
            rpd: forgeNewModel.rpd,
            tpd: forgeNewModel.tpd
        });
        setForgeNewModel({ name: '', modality: 'llm', rpm: 10, tpm: 100000, rpd: 1000, tpd: 10000000 });
        setIsForgeCustomModality(false);
        setForgeCustomModality('');
        setIsForgeAdding(false);
        EventBus.emit({ source: 'System', text: `Model node ${forgeNewModel.name} initialized.`, severity: 'success' });
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-500">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-start justify-between shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                    <div className="flex items-start gap-4 z-10">
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xl flex items-center justify-center italic">
                            {state.icon}
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xs font-bold text-emerald-500 tracking-[0.2em] uppercase opacity-80">
                                AI Provider Configuration
                            </h2>
                            <div className="flex items-center gap-2">
                                <input
                                    value={state.name}
                                    onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'name', value: e.target.value })}
                                    className="bg-transparent border-none p-0 font-bold text-zinc-100 text-2xl leading-tight focus:ring-0 w-full hover:bg-white/5 rounded px-1 -ml-1 transition-colors"
                                />
                                <span className="text-[11px] text-zinc-500 font-mono tracking-tighter bg-zinc-900 border border-white/5 px-2 py-0.5 rounded">
                                    {provider.id.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white z-10">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative">
                    <div className="neural-grid opacity-[0.03]" />

                    {/* Authorization Layer */}
                    <section className="space-y-4">
                        <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-500/50" />
                            Neural Vault Authorization
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest px-1">Secure API Key</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                                    <input
                                        type="password"
                                        placeholder="••••••••••••••••"
                                        value={state.apiKey}
                                        onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'apiKey', value: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest px-1">Network Endpoint</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
                                    <input
                                        type="text"
                                        placeholder="https://api.provider.ai/v1"
                                        value={state.baseUrl}
                                        onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'baseUrl', value: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">External Identifier</label>
                                    <Info size={12} className="text-zinc-700" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tadpole-OS-Client"
                                    value={state.externalId}
                                    onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'externalId', value: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-all font-mono"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Advanced Configuration */}
                    <section className="space-y-4">
                        <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Zap size={12} className="text-blue-500/50" />
                            Transmission Protocol
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest px-1">Hybrid Protocol</label>
                                <select
                                    value={state.protocol}
                                    onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'protocol', value: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 font-mono cursor-pointer appearance-none"
                                >
                                    <option value="openai">OpenAI (OpenRT)</option>
                                    <option value="anthropic">Anthropic (Messages)</option>
                                    <option value="google">Google (Vertex/AI)</option>
                                    <option value="ollama">Ollama (Local)</option>
                                    <option value="deepseek">DeepSeek (V3/R1)</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={state.isTesting}
                                    className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all ${state.testResult === 'success'
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-200'
                                        }`}
                                >
                                    {state.isTesting ? (
                                        <>
                                            <Activity size={12} className="animate-spin" />
                                            Tracing...
                                        </>
                                    ) : state.testResult === 'success' ? (
                                        <>
                                            <Check size={12} />
                                            Active
                                        </>
                                    ) : (
                                        <>
                                            <Activity size={12} />
                                            Test Trace
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest px-1">Custom HTTP Headers (JSON)</label>
                            <textarea
                                value={state.customHeaders}
                                onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'customHeaders', value: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] text-zinc-400 focus:outline-none focus:border-blue-500/40 h-24 font-mono resize-none custom-scrollbar"
                                placeholder='{ "X-Custom-Header": "value" }'
                            />
                        </div>
                    </section>

                    {/* Audio Transcription Configuration */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Zap size={12} className="text-amber-400/50" />
                                Audio Service
                            </h3>
                        </div>
                        <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1 flex items-center gap-2">
                                    Primary Transcription Model
                                    <Info size={10} className="hover:text-blue-400 cursor-help" />
                                </label>
                                <div className="space-y-2">
                                    <input
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-blue-400 focus:outline-none focus:border-blue-500 font-mono"
                                        placeholder="MODEL_ID (e.g. whisper-large-v3)"
                                        list="voice-inventory-suggestions"
                                        value={state.audioModel}
                                        onChange={e => dispatch({ type: 'UPDATE_FIELD', field: 'audioModel', value: e.target.value })}
                                    />
                                    <datalist id="voice-inventory-suggestions">
                                        <option value="whisper-large-v3" />
                                        {models
                                            .filter(m => m.provider === provider.id && m.modality?.toLowerCase() === 'voice')
                                            .map(m => (
                                                <option key={m.id} value={m.name}>
                                                    {m.name.toUpperCase()} (INVENTORY)
                                                </option>
                                            ))}
                                    </datalist>
                                </div>
                                <p className="text-[9px] text-zinc-600 font-medium px-1 italic">
                                    * Select a suggested node from your inventory or enter a custom identifier.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Model Forge section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Cpu size={12} className="text-blue-400/50" />
                                Intelligence Forge
                            </h3>
                            <button
                                onClick={() => setIsForgeAdding(true)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 hover:bg-blue-400/10 px-3 py-1.5 rounded-lg border border-blue-400/20 transition-all uppercase tracking-widest"
                            >
                                <Plus size={12} /> Add Node
                            </button>
                        </div>

                        <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
                            {isForgeAdding && (
                                <div className="p-4 bg-blue-500/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex gap-3">
                                        <input
                                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 flex-1 focus:outline-none focus:border-blue-500 font-mono"
                                            placeholder="MODEL_ID (e.g. gpt-4o)"
                                            autoFocus
                                            list="model-inventory-suggestions"
                                            value={forgeNewModel.name}
                                            onChange={e => setForgeNewModel({ ...forgeNewModel, name: e.target.value })}
                                        />
                                        <datalist id="model-inventory-suggestions">
                                            {MODEL_OPTIONS.map(opt => (
                                                <option key={opt} value={opt} />
                                            ))}
                                        </datalist>
                                        <select
                                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none cursor-pointer font-mono"
                                            value={isForgeCustomModality ? 'other' : forgeNewModel.modality}
                                            onChange={e => {
                                                if (e.target.value === 'other') {
                                                    setIsForgeCustomModality(true);
                                                } else {
                                                    setIsForgeCustomModality(false);
                                                    setForgeNewModel({ ...forgeNewModel, modality: e.target.value as any });
                                                }
                                            }}
                                        >
                                            <option value="llm">LLM</option>
                                            <option value="vision">VISION</option>
                                            <option value="voice">VOICE</option>
                                            <option value="reasoning">REASON</option>
                                            <option value="other">OTHER...</option>
                                        </select>
                                    </div>
                                    {isForgeCustomModality && (
                                        <input
                                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-blue-500 font-mono"
                                            placeholder="CUSTOM MODALITY..."
                                            value={forgeCustomModality}
                                            onChange={e => setForgeCustomModality(e.target.value)}
                                        />
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPM (Requests/Min)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500/40 outline-none"
                                                value={forgeNewModel.rpm}
                                                onChange={e => setForgeNewModel({ ...forgeNewModel, rpm: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPM (Tokens/Min)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500/40 outline-none"
                                                value={forgeNewModel.tpm}
                                                onChange={e => setForgeNewModel({ ...forgeNewModel, tpm: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPD (Requests/Day)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500/40 outline-none"
                                                value={forgeNewModel.rpd}
                                                onChange={e => setForgeNewModel({ ...forgeNewModel, rpd: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPD (Tokens/Day)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-blue-500/40 outline-none"
                                                value={forgeNewModel.tpd}
                                                onChange={e => setForgeNewModel({ ...forgeNewModel, tpd: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/50">
                                        <button onClick={handleForgeAdd} className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors">
                                            <Check size={16} />
                                        </button>
                                        <button onClick={() => setIsForgeAdding(false)} className="p-1.5 bg-zinc-800 text-zinc-500 rounded hover:bg-zinc-700 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {providerModels.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="inline-flex p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-600 mb-3">
                                        <Cpu size={24} />
                                    </div>
                                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">No intelligence nodes forged.</p>
                                </div>
                            ) : (
                                providerModels.map((m) => (
                                    <ForgeItem
                                        key={m.id}
                                        model={m}
                                        isEditing={editingModelId === m.id}
                                        onEdit={() => setEditingModelId(m.id)}
                                        onCancel={() => setEditingModelId(null)}
                                        onSave={(id, name, prov, modality, limits) => {
                                            editModel(id, name, prov, modality, limits);
                                            setEditingModelId(null);
                                        }}
                                        onDelete={() => deleteModel(m.id)}
                                    />
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={state.isTesting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98] uppercase tracking-widest"
                    >
                        <Save size={16} />
                        {state.isTesting ? 'Syncing...' : 'Commit Authorization'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ForgeItem({ model, isEditing, onEdit, onCancel, onSave, onDelete }: {
    model: ModelEntry;
    isEditing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: (id: string, name: string, prov: string, modality: ModelEntry['modality'], limits: any) => void;
    onDelete: () => void;
}) {
    const [editName, setEditName] = useState(model.name);
    const [editModality, setEditModality] = useState<ModelEntry['modality']>(model.modality || 'llm');
    const [isCustomModality, setIsCustomModality] = useState(!['llm', 'vision', 'voice', 'reasoning'].includes(model.modality || 'llm'));
    const [customModality, setCustomModality] = useState(model.modality || '');
    const [limits, setLimits] = useState({
        rpm: model.rpm || 10,
        tpm: model.tpm || 100000,
        rpd: model.rpd || 1000,
        tpd: model.tpd || 10000000
    });

    useEffect(() => {
        if (isEditing) {
            setEditName(model.name);
            setEditModality(model.modality || 'llm');
            const custom = !['llm', 'vision', 'voice', 'reasoning'].includes(model.modality || 'llm');
            setIsCustomModality(custom);
            setCustomModality(model.modality || '');
            setLimits({
                rpm: model.rpm || 10,
                tpm: model.tpm || 100000,
                rpd: model.rpd || 1000,
                tpd: model.tpd || 10000000
            });
        }
    }, [isEditing, model]);

    if (isEditing) {
        return (
            <div className="p-4 bg-emerald-500/[0.03] space-y-4 animate-in fade-in duration-300">
                <div className="flex gap-3">
                    <input
                        className="bg-zinc-950 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 flex-1 focus:outline-none focus:border-emerald-500 font-mono"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                    />
                    <select
                        className="bg-zinc-950 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-[11px] text-zinc-400 focus:outline-none uppercase font-bold"
                        value={isCustomModality ? 'other' : editModality}
                        onChange={e => {
                            if (e.target.value === 'other') {
                                setIsCustomModality(true);
                            } else {
                                setIsCustomModality(false);
                                setEditModality(e.target.value as any);
                            }
                        }}
                    >
                        <option value="llm">LLM</option>
                        <option value="vision">Vision</option>
                        <option value="voice">Voice</option>
                        <option value="reasoning">Reasoning</option>
                        <option value="other">Other...</option>
                    </select>
                </div>
                {isCustomModality && (
                    <input
                        className="bg-zinc-950 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="CUSTOM MODALITY..."
                        value={customModality}
                        onChange={e => setCustomModality(e.target.value)}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPM (Requests/Min)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-emerald-500/40 outline-none"
                            value={limits.rpm}
                            onChange={e => setLimits({ ...limits, rpm: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPM (Tokens/Min)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-emerald-500/40 outline-none"
                            value={limits.tpm}
                            onChange={e => setLimits({ ...limits, tpm: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPD (Requests/Day)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-emerald-500/40 outline-none"
                            value={limits.rpd}
                            onChange={e => setLimits({ ...limits, rpd: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPD (Tokens/Day)</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-emerald-500/40 outline-none"
                            value={limits.tpd}
                            onChange={e => setLimits({ ...limits, tpd: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/50">
                    <button
                        onClick={() => {
                            const finalModality = isCustomModality ? customModality : editModality;
                            onSave(model.id, editName, model.provider, finalModality, limits);
                        }}
                        className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                    >
                        <Check size={14} />
                    </button>
                    <button onClick={onCancel} className="p-1.5 bg-zinc-800 text-zinc-500 rounded hover:bg-zinc-700 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 px-4 flex items-center justify-between group hover:bg-zinc-900/50 transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg border flex items-center justify-center transition-colors ${model.modality === 'vision' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                    model.modality === 'voice' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                        model.modality === 'reasoning' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                            'bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:text-emerald-500'
                    }`}>
                    {model.modality === 'vision' ? <Activity size={12} /> :
                        model.modality === 'voice' ? <Info size={12} /> :
                            model.modality === 'reasoning' ? <Zap size={12} /> :
                                <Layers size={12} />}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-zinc-300 group-hover:text-zinc-100 uppercase tracking-tight">
                        {model.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
                            {model.modality || 'llm'}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-zinc-800" />
                        <span className="text-[10px] text-zinc-400 font-mono font-bold">
                            {(model.tpm || 100000).toLocaleString()} <span className="text-zinc-600 opacity-80">TPM</span>
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                    onClick={onEdit}
                    className="p-1.5 rounded hover:bg-emerald-500/10 text-zinc-700 hover:text-emerald-500"
                >
                    <Edit2 size={12} />
                </button>
                <button
                    onClick={onDelete}
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-700 hover:text-red-500"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}
