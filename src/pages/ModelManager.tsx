import { useState, useMemo, useEffect } from 'react';
import { Lock, Key, Plus, Trash2, Edit2, Check, X, Cpu, Filter, Activity, Sliders, Database } from 'lucide-react';
import { useProviderStore, type ModelEntry, type ProviderConfig } from '../services/providerStore';
import ProviderConfigPanel from '../components/ProviderConfigPanel';

export default function ModelManager() {
    const {
        isLocked, unlock, lock,
        providers, addProvider,
        models, addModel, editModel, deleteModel
    } = useProviderStore();

    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Navigation & UI States
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [modalityFilter, setModalityFilter] = useState<'all' | ModelEntry['modality']>('all');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Add states
    const [isAddingProvider, setIsAddingProvider] = useState(false);
    const [newProvider, setNewProvider] = useState({ name: '', icon: '⚡' });
    const [isAddingNode, setIsAddingNode] = useState(false);
    const [newNode, setNewNode] = useState({ name: '', provider: '', modality: 'llm' as ModelEntry['modality'], rpm: 10, tpm: 100000, rpd: 1000, tpd: 10000000 });
    const [isCustomModality, setIsCustomModality] = useState(false);
    const [customModality, setCustomModality] = useState('');

    const handleUnlock = async () => {
        setError(null);
        const success = await unlock(passwordInput);
        if (!success) setError('INVALID MASTER KEY');
        setPasswordInput('');
    };

    const selectedProvider = useMemo(() =>
        providers.find(p => p.id === selectedProviderId),
        [providers, selectedProviderId]
    );

    const filteredModels = useMemo(() => {
        let filtered = [...models];
        if (modalityFilter !== 'all') {
            filtered = filtered.filter(m => m.modality === modalityFilter);
        }
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [models, modalityFilter]);

    if (isLocked) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500 min-h-[500px] relative">
                <div className="neural-grid" />
                <div className="relative group">
                    <div className="absolute -inset-8 bg-emerald-500/10 blur-3xl rounded-full animate-pulse transition-opacity duration-700" />
                    <div className="relative p-8 bg-zinc-900 border border-emerald-500/30 rounded-[2rem] shadow-2xl shadow-emerald-500/10 group-hover:shadow-emerald-500/20 transition-all">
                        <Lock className="w-12 h-12 text-emerald-500/80" />
                    </div>
                </div>
                <div className="text-center space-y-3 max-w-sm px-6 relative">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center justify-center gap-2 font-mono">
                        <span className="text-emerald-500">◈</span> NEURAL VAULT
                    </h1>
                    <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] leading-relaxed uppercase">
                        Administrative access required for neural infrastructure modification.
                    </p>
                </div>
                <div className="w-full max-w-xs space-y-6 px-4 relative">
                    <div className="space-y-3">
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                placeholder="MASTER PASSPHRASE..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                autoFocus
                            />
                        </div>
                        {error && <p className="text-red-500 text-[9px] text-center font-bold uppercase tracking-[0.2em]">{error}</p>}
                        <button
                            onClick={handleUnlock}
                            className="w-full bg-zinc-100 text-zinc-900 font-bold py-3 rounded-xl hover:bg-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98] text-[10px] uppercase tracking-widest"
                        >
                            Commit Authorization
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-zinc-950 relative overflow-hidden">
            <div className="neural-grid opacity-5 pointer-events-none" />

            {/* Top Navigation */}
            <div className="py-2 px-6 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <span className="text-emerald-500">◈</span> AI PROVIDER MANAGER
                    </h1>
                    <div className="h-4 w-px bg-zinc-800" />
                    <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 font-mono tracking-widest uppercase">
                        <Activity size={12} className="text-emerald-500" />
                        Status: Nominal • Nodes: {providers.length}/25
                    </div>
                </div>
                <button
                    onClick={lock}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] font-bold text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase tracking-widest"
                >
                    <Lock size={12} /> Lock Session
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <div className="max-w-7xl mx-auto p-8 space-y-12">

                    {/* Infrastructure Grid */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                <Database size={12} className="text-emerald-500" />
                                Neural Infrastructure Grid
                            </h2>
                            <button
                                onClick={() => setIsAddingProvider(true)}
                                disabled={providers.length >= 25}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10 transition-colors uppercase tracking-widest disabled:opacity-30"
                            >
                                <Plus size={12} /> Add Provider
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {providers.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProviderId(p.id)}
                                    className={`group p-5 bg-zinc-900/40 border rounded-2xl transition-all duration-300 relative overflow-hidden flex flex-col items-start gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] ${selectedProviderId === p.id ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800'}`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="text-2xl italic">{p.icon}</div>
                                        <Sliders size={14} className="text-zinc-700 group-hover:text-emerald-400 transition-colors" />
                                    </div>
                                    <div className="space-y-0.5 text-left">
                                        <h3 className="font-bold text-zinc-100 text-sm tracking-tight">{p.name}</h3>
                                        <p className="text-[11px] font-mono text-zinc-600 uppercase group-hover:text-zinc-400 transition-colors">
                                            {p.protocol || 'API'} • {models.filter(m => m.provider === p.id).length} nodes
                                        </p>
                                    </div>
                                    {selectedProviderId === p.id && (
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 blur-xl rounded-full" />
                                    )}
                                </button>
                            ))}

                            {isAddingProvider && (
                                <div className="p-5 bg-zinc-900 border border-emerald-500/30 rounded-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 shadow-xl shadow-emerald-500/5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-[10px] text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                                            placeholder="NAME"
                                            value={newProvider.name}
                                            onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                                            autoFocus
                                        />
                                        <input
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-center text-sm"
                                            placeholder="⚡"
                                            value={newProvider.icon}
                                            onChange={e => setNewProvider({ ...newProvider, icon: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                try {
                                                    addProvider(newProvider.name, newProvider.icon);
                                                    setIsAddingProvider(false);
                                                    setNewProvider({ name: '', icon: '⚡' });
                                                } catch (e: any) {
                                                    setError(e.message);
                                                }
                                            }}
                                            className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 rounded-xl transition-all text-[9px] font-bold uppercase tracking-widest"
                                        >
                                            Initialize
                                        </button>
                                        <button
                                            onClick={() => setIsAddingProvider(false)}
                                            className="flex-1 py-2 bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 rounded-xl transition-all text-[9px] font-bold uppercase tracking-widest"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Intelligence Inventory CRUD */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                <Cpu size={12} className="text-blue-500" />
                                Master Intelligence Inventory
                            </h2>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        setIsAddingNode(!isAddingNode);
                                        if (providers.length > 0) setNewNode(prev => ({ ...prev, provider: providers[0].id }));
                                    }}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 hover:bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/10 transition-colors uppercase tracking-widest"
                                >
                                    <Plus size={12} /> Add Node
                                </button>
                                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
                                    <Filter size={10} className="text-zinc-600" />
                                    <select
                                        value={modalityFilter}
                                        onChange={(e) => setModalityFilter(e.target.value as any)}
                                        className="bg-transparent border-none text-[9px] font-bold text-zinc-400 uppercase focus:ring-0 cursor-pointer"
                                    >
                                        <option value="all">All Modalities</option>
                                        <option value="llm">LLM</option>
                                        <option value="vision">Vision</option>
                                        <option value="voice">Voice</option>
                                        <option value="reasoning">Reasoning</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-zinc-950/80 backdrop-blur text-zinc-500 text-[9px] uppercase tracking-[0.2em] border-b border-zinc-800">
                                    <tr>
                                        <th className="px-8 py-5 font-bold text-[11px]">Model Identity</th>
                                        <th className="px-8 py-5 font-bold text-[11px]">Modality</th>
                                        <th className="px-8 py-5 font-bold text-[11px]">Provider Chain</th>
                                        <th className="px-8 py-5 font-bold text-right text-[11px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30 font-mono text-[11px]">
                                    {isAddingNode && (
                                        <>
                                            <tr className="bg-blue-500/5 animate-in slide-in-from-top-2 duration-300">
                                                <td className="px-8 py-4">
                                                    <input
                                                        className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-blue-500 font-mono"
                                                        placeholder="MODEL NAME (e.g. gpt-4o)"
                                                        value={newNode.name}
                                                        onChange={e => setNewNode({ ...newNode, name: e.target.value })}
                                                    />
                                                </td>
                                                <td className="px-8 py-4">
                                                    <select
                                                        className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-[10px] text-zinc-400 w-full focus:outline-none cursor-pointer uppercase font-bold"
                                                        value={isCustomModality ? 'other' : newNode.modality}
                                                        onChange={e => {
                                                            if (e.target.value === 'other') {
                                                                setIsCustomModality(true);
                                                            } else {
                                                                setIsCustomModality(false);
                                                                setNewNode({ ...newNode, modality: e.target.value as any });
                                                            }
                                                        }}
                                                    >
                                                        <option value="llm">LLM</option>
                                                        <option value="vision">Vision</option>
                                                        <option value="voice">Voice</option>
                                                        <option value="reasoning">Reasoning</option>
                                                        <option value="other">Other...</option>
                                                    </select>
                                                    {isCustomModality && (
                                                        <input
                                                            className="mt-2 bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-blue-500 font-mono"
                                                            placeholder="CUSTOM MODALITY..."
                                                            value={customModality}
                                                            onChange={e => setCustomModality(e.target.value)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-8 py-4">
                                                    <select
                                                        className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-[10px] text-zinc-400 w-full focus:outline-none cursor-pointer uppercase font-bold"
                                                        value={newNode.provider}
                                                        onChange={e => setNewNode({ ...newNode, provider: e.target.value })}
                                                    >
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => {
                                                                if (!newNode.name || !newNode.provider) return;
                                                                const finalModality = isCustomModality ? customModality : newNode.modality;
                                                                addModel(newNode.name, newNode.provider, finalModality, {
                                                                    rpm: newNode.rpm,
                                                                    tpm: newNode.tpm,
                                                                    rpd: newNode.rpd,
                                                                    tpd: newNode.tpd
                                                                });
                                                                setIsAddingNode(false);
                                                                setNewNode({ name: '', provider: '', modality: 'llm', rpm: 10, tpm: 100000, rpd: 1000, tpd: 10000000 });
                                                                setIsCustomModality(false);
                                                                setCustomModality('');
                                                            }}
                                                            className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button onClick={() => setIsAddingNode(false)} className="p-1.5 bg-zinc-800 text-zinc-500 rounded hover:bg-zinc-700 transition-all"><X size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className="bg-blue-500/[0.02] border-b border-blue-500/10">
                                                <td colSpan={4} className="px-12 py-5">
                                                    <div className="grid grid-cols-4 gap-8">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPM (Requests/Min)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                                                value={newNode.rpm}
                                                                onChange={e => setNewNode({ ...newNode, rpm: parseInt(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPM (Tokens/Min)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                                                value={newNode.tpm}
                                                                onChange={e => setNewNode({ ...newNode, tpm: parseInt(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPD (Requests/Day)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                                                value={newNode.rpd}
                                                                onChange={e => setNewNode({ ...newNode, rpd: parseInt(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPD (Tokens/Day)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                                                value={newNode.tpd}
                                                                onChange={e => setNewNode({ ...newNode, tpd: parseInt(e.target.value) || 0 })}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                    {filteredModels.map((m) => (
                                        <ModelRow
                                            key={m.id}
                                            model={m}
                                            isEditing={editingId === m.id}
                                            onEdit={() => setEditingId(m.id)}
                                            onSave={(name, prov, modality, limits) => { editModel(m.id, name, prov, modality, limits); setEditingId(null); }}
                                            onCancel={() => setEditingId(null)}
                                            onDelete={() => deleteModel(m.id)}
                                            providers={providers}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            {/* Provider Side-Drawer */}
            {selectedProvider && (
                <ProviderConfigPanel
                    provider={selectedProvider}
                    onClose={() => setSelectedProviderId(null)}
                />
            )}
        </div>
    );
}

function ModelRow({ model, isEditing, onEdit, onSave, onCancel, onDelete, providers }: {
    model: ModelEntry;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (name: string, prov: string, modality: ModelEntry['modality'], limits: any) => void;
    onCancel: () => void;
    onDelete: () => void;
    providers: ProviderConfig[];
}) {
    const [editName, setEditName] = useState(model.name);
    const [editProv, setEditProv] = useState(model.provider);
    const [editModality, setEditModality] = useState<ModelEntry['modality']>(model.modality || 'llm');
    const [isCustomModality, setIsCustomModality] = useState(!['llm', 'vision', 'voice', 'reasoning'].includes(model.modality || 'llm'));
    const [customModality, setCustomModality] = useState(model.modality || '');
    const [limits, setLimits] = useState({
        rpm: model.rpm || 10,
        tpm: model.tpm || 100000,
        rpd: model.rpd || 1000,
        tpd: model.tpd || 10000000
    });
    const [showLimits, setShowLimits] = useState(false);

    // Instead of reset in parent, we use useEffect to reset when entering editing mode
    useEffect(() => {
        if (isEditing) {
            setEditName(model.name);
            setEditProv(model.provider);
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
            <>
                <tr className="bg-blue-500/[0.03]">
                    <td className="px-8 py-4">
                        <input
                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-blue-500 font-mono"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                        />
                    </td>
                    <td className="px-8 py-4">
                        <select
                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-[10px] text-zinc-400 w-full focus:outline-none cursor-pointer uppercase font-bold"
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
                        {isCustomModality && (
                            <input
                                className="mt-2 bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-100 w-full focus:outline-none focus:border-blue-500 font-mono"
                                placeholder="CUSTOM..."
                                value={customModality}
                                onChange={e => setCustomModality(e.target.value)}
                            />
                        )}
                    </td>
                    <td className="px-8 py-4">
                        <select
                            className="bg-zinc-950 border border-blue-500/30 rounded-lg px-3 py-1.5 text-[10px] text-zinc-400 w-full focus:outline-none cursor-pointer uppercase font-bold"
                            value={editProv}
                            onChange={e => setEditProv(e.target.value)}
                        >
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                        </select>
                    </td>
                    <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    const finalModality = isCustomModality ? customModality : editModality;
                                    onSave(editName, editProv, finalModality, limits);
                                }}
                                className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-all"
                            >
                                <Check size={14} />
                            </button>
                            <button onClick={onCancel} className="p-1.5 bg-zinc-800 text-zinc-500 rounded hover:bg-zinc-700 transition-all"><X size={14} /></button>
                        </div>
                    </td>
                </tr>
                <tr className="bg-blue-500/[0.02]">
                    <td colSpan={4} className="px-12 py-5 border-b border-blue-500/10">
                        <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPM (Requests/Min)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                    value={limits.rpm}
                                    onChange={e => setLimits({ ...limits, rpm: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPM (Tokens/Min)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                    value={limits.tpm}
                                    onChange={e => setLimits({ ...limits, tpm: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">RPD (Requests/Day)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                    value={limits.rpd}
                                    onChange={e => setLimits({ ...limits, rpd: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-1">TPD (Tokens/Day)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-400 font-mono focus:outline-none focus:border-blue-500/50"
                                    value={limits.tpd}
                                    onChange={e => setLimits({ ...limits, tpd: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </td>
                </tr>
            </>
        );
    }

    return (
        <>
            <tr className="hover:bg-zinc-900/60 transition-all group border-b border-zinc-800/20 last:border-none">
                <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40 group-hover:bg-blue-400 transition-colors shadow-[0_0_5px_rgba(59,130,246,0.2)]" />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-zinc-200 uppercase tracking-tight">{model.name}</span>
                            <button
                                onClick={() => setShowLimits(!showLimits)}
                                className="text-[11px] text-zinc-600 hover:text-blue-400 font-bold mt-1 transition-colors flex items-center gap-1 uppercase tracking-widest"
                            >
                                {showLimits ? '▼ Hide TPM Limits' : '▶ Show TPM Limits'}
                            </button>
                        </div>
                    </div>
                </td>
                <td className="px-8 py-5">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${model.modality === 'vision' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        model.modality === 'voice' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                            model.modality === 'reasoning' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                'bg-zinc-800/50 border-white/5 text-zinc-500'
                        }`}>
                        {model.modality || 'llm'}
                    </span>
                </td>
                <td className="px-8 py-5">
                    <span className="text-[11px] font-bold font-mono text-zinc-500 uppercase tracking-tighter bg-zinc-900 border border-white/5 px-2 py-0.5 rounded">
                        {model.provider}
                    </span>
                </td>
                <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-100 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                </td>
            </tr>
            {showLimits && (
                <tr className="bg-zinc-950/80 border-b border-zinc-900/40">
                    <td colSpan={4} className="px-12 py-5 animate-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-4 gap-8">
                            <div className="space-y-1">
                                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Req / Minute</div>
                                <div className="text-xs font-mono text-zinc-400">{model.rpm || 10}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Tokens / Minute</div>
                                <div className="text-xs font-mono text-zinc-400">{(model.tpm || 100000).toLocaleString()}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Req / Day</div>
                                <div className="text-xs font-mono text-zinc-400">{(model.rpd || 1000).toLocaleString()}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Tokens / Day</div>
                                <div className="text-xs font-mono text-zinc-400">{(model.tpd || 10000000).toLocaleString()}</div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
