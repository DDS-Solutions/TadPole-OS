import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit2, Code, FileText, AlertTriangle, Activity, Terminal, Shield } from 'lucide-react';
import { useCapabilitiesStore, type SkillDefinition, type WorkflowDefinition } from '../services/capabilitiesStore';

export default function Capabilities() {
    const { skills, workflows, isLoading, error, fetchCapabilities, saveSkill, deleteSkill, saveWorkflow, deleteWorkflow } = useCapabilitiesStore();
    const [activeTab, setActiveTab] = useState<'skills' | 'workflows'>('skills');

    // Skill Modal State
    const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Partial<SkillDefinition>>({});
    const [skillSaveError, setSkillSaveError] = useState<string | null>(null);
    const [schemaError, setSchemaError] = useState<string | null>(null);

    // Workflow Modal State
    const [isWfModalOpen, setIsWfModalOpen] = useState(false);
    const [editingWf, setEditingWf] = useState<Partial<WorkflowDefinition>>({});
    const [wfSaveError, setWfSaveError] = useState<string | null>(null);

    // Shared State
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchCapabilities();
    }, [fetchCapabilities]);

    const handleSaveSkill = async () => {
        if (!editingSkill.name || !editingSkill.execution_command) return;
        setSkillSaveError(null);
        setIsSaving(true);
        try {
            await saveSkill(editingSkill as SkillDefinition);
            setIsSkillModalOpen(false);
        } catch (e: any) {
            setSkillSaveError(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveWf = async () => {
        if (!editingWf.name || !editingWf.content) return;
        setWfSaveError(null);
        setIsSaving(true);
        try {
            await saveWorkflow(editingWf as WorkflowDefinition);
            setIsWfModalOpen(false);
        } catch (e: any) {
            setWfSaveError(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Standardized Module Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2 px-1 shrink-0">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                        <Settings className="text-blue-500" /> SKILLS & WORKFLOWS
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono mt-1 tracking-wide uppercase">
                        ACTIVE SKILLS: {skills.length} •
                        PASSIVE WORKFLOWS: {workflows.length}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-2 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                    <p>{error}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-zinc-800 shrink-0">
                <button
                    onClick={() => setActiveTab('skills')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'skills' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <Code className="w-4 h-4" /> ACTIVE SKILLS
                </button>
                <button
                    onClick={() => setActiveTab('workflows')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'workflows' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <FileText className="w-4 h-4" /> PASSIVE WORKFLOWS
                </button>
                <button
                    onClick={() => (setActiveTab as any)('hooks')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${(activeTab as any) === 'hooks' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <Shield className="w-4 h-4" /> LIFECYCLE HOOKS
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                {isLoading ? (
                    <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : activeTab === 'skills' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-zinc-950/80 backdrop-blur-md pt-2 pb-3 border-b border-zinc-800/50 z-20">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Activity size={12} className="text-blue-500" /> EXECUTION SKILLS
                            </h3>
                            <button
                                onClick={() => {
                                    setEditingSkill({ schema: { type: "object", properties: {} } });
                                    setSkillSaveError(null);
                                    setSchemaError(null);
                                    setIsSkillModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                            >
                                <Plus className="w-3.5 h-3.5" /> NEW SKILL
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            {skills.map(skill => (
                                <div key={skill.name} className="bg-zinc-950 border border-zinc-800 p-5 rounded-xl transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] group relative overflow-hidden shadow-sm">
                                    <div className="neural-grid opacity-[0.03]" />
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button onClick={() => { setEditingSkill(skill); setSkillSaveError(null); setSchemaError(null); setIsSkillModalOpen(true); }} className="text-zinc-500 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 p-1.5 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => deleteSkill(skill.name)} className="text-zinc-500 hover:text-red-400 bg-zinc-900 hover:bg-zinc-800 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-2 pr-16 text-zinc-300 font-bold tracking-wide">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500/30 group-hover:bg-emerald-400 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all shrink-0 mt-0.5"></div>
                                            <h3 className="font-mono text-sm">{skill.name}</h3>
                                        </div>
                                        <p className="text-zinc-500 text-xs line-clamp-2 mb-4 h-8 leading-relaxed font-mono">{skill.description}</p>
                                        <div className="bg-black/40 border border-zinc-800/50 p-2.5 rounded font-mono text-[10px] text-zinc-300 flex items-center gap-2 overflow-x-auto">
                                            <Terminal className="w-3 h-3 flex-shrink-0 text-zinc-500" />
                                            <span className="whitespace-nowrap">{skill.execution_command}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {skills.length === 0 && <div className="col-span-full text-center p-12 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">NO SKILLS CONFIGURED.</div>}
                        </div>
                    </div>
                ) : activeTab === 'workflows' ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-zinc-950/80 backdrop-blur-md pt-2 pb-3 border-b border-zinc-800/50 z-20">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Activity size={12} className="text-blue-500" /> GUIDING WORKFLOWS
                            </h3>
                            <button
                                onClick={() => {
                                    setEditingWf({});
                                    setWfSaveError(null);
                                    setIsWfModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                            >
                                <Plus className="w-3.5 h-3.5" /> NEW WORKFLOW
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                            {workflows.map(wf => (
                                <div key={wf.name} className="bg-zinc-950 border border-zinc-800 p-5 rounded-xl transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] group relative overflow-hidden shadow-sm">
                                    <div className="neural-grid opacity-[0.03]" />
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button onClick={() => { setEditingWf(wf); setWfSaveError(null); setIsWfModalOpen(true); }} className="text-zinc-500 hover:text-blue-400 bg-zinc-900 hover:bg-zinc-800 p-1.5 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => deleteWorkflow(wf.name)} className="text-zinc-500 hover:text-red-400 bg-zinc-900 hover:bg-zinc-800 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex items-center gap-3 mb-3 pr-16 text-zinc-300 font-bold tracking-wide">
                                            <div className="w-2 h-2 rounded-full bg-amber-500/30 group-hover:bg-amber-400 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all shrink-0 mt-0.5"></div>
                                            <h3 className="font-mono text-sm">{wf.name}</h3>
                                        </div>
                                        <div className="bg-black/40 border border-zinc-800/50 p-3 rounded text-[11px] text-zinc-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar flex-1">
                                            {wf.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {workflows.length === 0 && <div className="col-span-full text-center p-12 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">NO WORKFLOWS CONFIGURED.</div>}
                        </div>
                    </div>
                ) : ( // activeTab === 'hooks'
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-zinc-950/80 backdrop-blur-md pt-2 pb-3 border-b border-zinc-800/50 z-20">
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Shield size={12} className="text-emerald-500" /> SYSTEM HOOKS & AUDITS
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl group relative overflow-hidden">
                                <div className="absolute top-4 right-4 text-emerald-500/50 group-hover:text-emerald-400 transition-colors uppercase text-[10px] font-bold tracking-tighter">PRE-TOOL VALIDATION</div>
                                <h3 className="font-mono text-sm text-zinc-100 mb-2">audit_governance_v1</h3>
                                <p className="text-zinc-500 text-xs font-mono mb-4">Ensures all tool calls comply with core safety directives before execution. Blocks unauthorized parameter modification.</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">Status: Active</span>
                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700/50 uppercase font-bold">Type: Security</span>
                                </div>
                            </div>
                            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl group relative overflow-hidden">
                                <div className="absolute top-4 right-4 text-blue-500/50 group-hover:text-blue-400 transition-colors uppercase text-[10px] font-bold tracking-tighter">POST-TOOL ANALYSIS</div>
                                <h3 className="font-mono text-sm text-zinc-100 mb-2">memory_sync_v2</h3>
                                <p className="text-zinc-500 text-xs font-mono mb-4">Extracts key insights from tool outputs and commits them to long-term persistent memory ledgers.</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">Status: Active</span>
                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700/50 uppercase font-bold">Type: Cognitive</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Skill Edit Modal */}
            {isSkillModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
                        <div className="neural-grid opacity-10" />
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center shrink-0 relative z-10 bg-zinc-950/50">
                            <h2 className="text-xs font-bold text-zinc-100 font-mono uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                {editingSkill.name ? 'EDIT SKILL' : 'CREATE SKILL'}
                            </h2>
                            <button onClick={() => setIsSkillModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-1">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar relative z-10 bg-zinc-950/80">
                            <div>
                                <label className="block text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">Skill Name (No spaces)</label>
                                <input
                                    type="text"
                                    value={editingSkill.name || ''}
                                    onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value.replace(/\s+/g, '_') })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-zinc-200 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-zinc-700"
                                    placeholder="fetch_twitter_data"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">LLM Description</label>
                                <textarea
                                    value={editingSkill.description || ''}
                                    onChange={e => setEditingSkill({ ...editingSkill, description: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-y min-h-[80px] text-sm placeholder:text-zinc-700"
                                    placeholder="Scrapes a twitter profile..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">Execution Command</label>
                                <input
                                    type="text"
                                    value={editingSkill.execution_command || ''}
                                    onChange={e => setEditingSkill({ ...editingSkill, execution_command: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-emerald-400 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-zinc-700"
                                    placeholder="python scripts/fetch.py"
                                />
                                <p className="text-[10px] text-zinc-500 mt-2 font-mono">Args will be passed as JSON in `TADPOLE_SKILL_ARGS` env var.</p>
                            </div>
                            <div>
                                <label className="flex items-center justify-between text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">
                                    <span>Parameters Schema (JSON)</span>
                                    {schemaError && <span className="text-red-400 normal-case">{schemaError}</span>}
                                </label>
                                <textarea
                                    value={typeof editingSkill.schema === 'string' ? editingSkill.schema : JSON.stringify(editingSkill.schema, null, 2)}
                                    onChange={e => {
                                        try {
                                            const val = JSON.parse(e.target.value);
                                            setEditingSkill({ ...editingSkill, schema: val });
                                            setSchemaError(null);
                                        } catch {
                                            setEditingSkill({ ...editingSkill, schema: e.target.value as any });
                                            setSchemaError("Invalid JSON");
                                        }
                                    }}
                                    className={`w-full bg-zinc-900 border rounded p-3 font-mono text-xs focus:ring-1 outline-none transition-all resize-y min-h-[150px] custom-scrollbar ${schemaError ? 'border-red-500/50 text-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-zinc-800 text-zinc-300 focus:border-blue-500 focus:ring-blue-500/50'}`}
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 shrink-0 relative z-10 bg-zinc-950/90 items-center">
                            {skillSaveError && <div className="text-xs text-red-400 font-mono mr-auto flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {skillSaveError}</div>}
                            <button onClick={() => setIsSkillModalOpen(false)} className="px-6 py-2 rounded-lg text-sm text-zinc-400 font-bold hover:bg-zinc-800 hover:text-white transition-colors" disabled={isSaving}>CANCEL</button>
                            <button onClick={handleSaveSkill} disabled={isSaving || !!schemaError || !editingSkill.name || !editingSkill.execution_command} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'SAVING...' : 'SAVE SKILL'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Edit Modal */}
            {isWfModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden">
                        <div className="neural-grid opacity-10" />
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center shrink-0 relative z-10 bg-zinc-950/50">
                            <h2 className="text-xs font-bold text-zinc-100 font-mono uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                {editingWf.name ? 'EDIT WORKFLOW' : 'CREATE WORKFLOW'}
                            </h2>
                            <button onClick={() => setIsWfModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-1">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1 relative z-10 bg-zinc-950/80">
                            <div>
                                <label className="block text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">Workflow Name</label>
                                <input
                                    type="text"
                                    value={editingWf.name || ''}
                                    onChange={e => setEditingWf({ ...editingWf, name: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 text-purple-300 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-zinc-700"
                                    placeholder="Deep Research Protocol"
                                />
                            </div>
                            <div className="flex-1 flex flex-col h-full min-h-[400px]">
                                <label className="block text-[10px] text-zinc-500 font-bold mb-2 uppercase tracking-[0.1em]">Markdown Content</label>
                                <textarea
                                    value={editingWf.content || ''}
                                    onChange={e => setEditingWf({ ...editingWf, content: e.target.value })}
                                    className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded p-4 text-zinc-300 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-none custom-scrollbar placeholder:text-zinc-700"
                                    placeholder="# Protocol Overview\n1. Do X\n2. Do Y"
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 shrink-0 relative z-10 bg-zinc-950/90 items-center">
                            {wfSaveError && <div className="text-xs text-red-400 font-mono mr-auto flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {wfSaveError}</div>}
                            <button onClick={() => setIsWfModalOpen(false)} className="px-6 py-2 rounded-lg text-sm text-zinc-400 font-bold hover:bg-zinc-800 hover:text-white transition-colors" disabled={isSaving}>CANCEL</button>
                            <button onClick={handleSaveWf} disabled={isSaving || !editingWf.name || !editingWf.content} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'SAVING...' : 'SAVE WORKFLOW'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
