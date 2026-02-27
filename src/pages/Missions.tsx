/**
 * @page Missions
 * Mission Management Central.
 * Allows assigning agents to mission clusters and defining their specific roles.
 */
import { Users, Target, Shield, Plus, Trash2, Crown, Zap, Globe, Cpu, Repeat, Check, X, ShieldCheck } from 'lucide-react';
import { useWorkspaceStore } from '../services/workspaceStore';
import { OpenClawService } from '../services/openclawService';
import { EventBus } from '../services/eventBus';
import { openClawSocket } from '../services/openclawSocket';
import { useState, useEffect } from 'react';
import type { MissionCluster } from '../services/workspaceStore';

import { useAgentStore } from '../services/agentStore';

export default function Missions() {
    const {
        clusters,
        assignAgentToCluster,
        unassignAgentFromCluster,
        updateClusterObjective,
        setAlphaNode,
        deleteCluster,
        toggleClusterActive,
        approveBranch,
        rejectBranch,
        updateClusterDepartment,
        updateClusterBudget
    } = useWorkspaceStore();
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(clusters[0]?.id || null);
    const [newMissionBudget, setNewMissionBudget] = useState('1.00');
    const { agents, fetchAgents } = useAgentStore();

    useEffect(() => {
        if (agents.length === 0) {
            fetchAgents();
        }

        // Listen for cross-cluster handoffs
        const unsubscribeHandoff = openClawSocket.subscribeHandoff((data: any) => {
            useWorkspaceStore.getState().receiveHandoff(data.sourceClusterId, data.targetClusterId, data.description);
            EventBus.emit({
                source: 'System',
                text: `🔀 New handoff received for cluster ${data.targetClusterId}`,
                severity: 'info'
            });
        });

        return () => {
            unsubscribeHandoff();
        };
    }, []);

    const activeCluster = clusters.find(c => c.id === selectedClusterId);

    // Group agents by their current assignment
    const assignedAgentIds = new Set(clusters.flatMap(c => c.collaborators));
    const availableAgents = agents.filter(a => !assignedAgentIds.has(a.id));

    const handleAssign = (agentId: string) => {
        if (selectedClusterId) {
            assignAgentToCluster(agentId, selectedClusterId);
        }
    };

    const handleDelete = (agentId: string) => {
        if (selectedClusterId) {
            unassignAgentFromCluster(agentId, selectedClusterId);
        }
    };

    const handleDeleteCluster = (e: React.MouseEvent, clusterId: string) => {
        e.stopPropagation();
        if (clusters.length <= 1) return; // Prevent deleting last cluster
        deleteCluster(clusterId);
        if (selectedClusterId === clusterId) {
            setSelectedClusterId(clusters.find(c => c.id !== clusterId)?.id || null);
        }
    };

    const handleToggleActive = (e: React.MouseEvent, clusterId: string) => {
        e.stopPropagation();
        toggleClusterActive(clusterId);
    };

    const getDeptIcon = (dept: string) => {
        if (dept === 'Executive') return Shield;
        if (dept === 'Engineering') return Cpu;
        if (dept === 'Operations') return Zap;
        if (dept === 'Product') return Globe;
        if (dept === 'Quality Assurance') return ShieldCheck;
        return Users;
    };

    const getThemeColors = (theme: string) => {
        switch (theme) {
            case 'cyan': return { text: 'text-cyan-400', border: 'border-cyan-500/50', bg: 'bg-cyan-500/5', glow: 'shadow-cyan-500/10' };
            case 'purple': return { text: 'text-purple-400', border: 'border-purple-500/50', bg: 'bg-purple-500/5', glow: 'shadow-purple-500/10' };
            case 'amber': return { text: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/5', glow: 'shadow-amber-500/10' };
            default: return { text: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/5', glow: 'shadow-blue-500/10' };
        }
    };

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCluster, setNewCluster] = useState({
        name: '',
        department: 'Engineering' as MissionCluster['department'],
        theme: 'blue' as const,
        path: '/workspaces/new-mission',
        collaborators: [] as string[]
    });

    const handleCreateCluster = () => {
        useWorkspaceStore.getState().createCluster({
            ...newCluster,
            budgetUsd: parseFloat(newMissionBudget)
        });
        setShowCreateModal(false);
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Target className="text-blue-500" /> MISSION MANAGEMENT
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono mt-1">SWARM ALLOCATION • {clusters.length} ACTIVE CLUSTERS</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Cluster Sidebar */}
                <div className="md:col-span-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pl-1">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Active Mission Clusters</h3>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="p-1 px-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center gap-1"
                        >
                            <Plus size={10} /> NEW MISSION
                        </button>
                    </div>

                    {showCreateModal && (
                        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 animate-in slide-in-from-top-2">
                            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Define New Cluster</h4>
                            <div className="space-y-3">
                                <input
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
                                    placeholder="Mission Name..."
                                    value={newCluster.name}
                                    onChange={e => setNewCluster({ ...newCluster, name: e.target.value })}
                                />
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Mission Budget</label>
                                        <div className="group/tip relative">
                                            <Target size={10} className="text-zinc-600 cursor-help" />
                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-700 rounded shadow-xl text-[9px] text-zinc-400 invisible group-hover/tip:visible animate-in fade-in slide-in-from-bottom-1 z-50">
                                                Allocated neural credits for this swarm branch. Controls resource priority.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-[10px]">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 pl-4 text-xs text-zinc-200 font-mono"
                                            placeholder="0.00"
                                            value={newMissionBudget}
                                            onChange={e => setNewMissionBudget(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 group/valuetip">
                                        <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-tighter cursor-help">Allocated Swarm Capital</span>
                                        <div className="absolute bottom-full left-0 mb-1 w-32 p-1.5 bg-zinc-900 border border-zinc-800 rounded shadow-lg text-[8px] text-zinc-500 invisible group-hover/valuetip:visible z-50">
                                            Verified dollar value for mission resources.
                                        </div>
                                    </div>
                                </div>
                                {/* Department Selection: Includes core business functions + new specialized roles (Design, Research, Support) */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Department</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300"
                                            value={newCluster.department}
                                            onChange={e => setNewCluster({ ...newCluster, department: e.target.value as MissionCluster['department'] })}
                                        >
                                            <option value="Executive">Executive</option>
                                            <option value="Engineering">Engineering</option>
                                            <option value="Operations">Operations</option>
                                            <option value="Product">Product</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Sales">Sales</option>
                                            <option value="Design">Design</option>
                                            <option value="Research">Research</option>
                                            <option value="Support">Support</option>
                                            <option value="Quality Assurance">Quality Assurance</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleCreateCluster}
                                        disabled={!newCluster.name}
                                        className="h-[34px] px-3 bg-blue-600 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                                    >
                                        CREATE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {clusters.map(cluster => {
                        const isSelected = selectedClusterId === cluster.id;
                        const theme = getThemeColors(cluster.theme);
                        const isActive = cluster.isActive;

                        return (
                            <div
                                key={cluster.id}
                                onClick={() => setSelectedClusterId(cluster.id)}
                                className={`
                                    group relative p-3 rounded-xl border transition-all cursor-pointer overflow-hidden
                                    ${isSelected ? `${theme.bg} ${theme.border} shadow-lg ${theme.glow}` : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
                                    ${isActive ? 'ring-1 ring-emerald-500/30' : ''}
                                `}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
                                )}

                                <div className="flex justify-between items-start mb-2 relative z-10 gap-2">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-xs font-bold truncate ${isSelected ? theme.text : 'text-zinc-300'}`}>
                                            {cluster.name}
                                        </span>
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-wider">Department</span>
                                            <div className="flex items-center gap-2">
                                                <div className="relative group/dept">
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase group-hover/dept:text-zinc-300 group-hover/dept:border-zinc-700 transition-colors">
                                                        {cluster.department}
                                                    </span>
                                                    <select
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-zinc-950 text-zinc-300"
                                                        value={cluster.department}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            updateClusterDepartment(cluster.id, e.target.value as MissionCluster['department']);
                                                        }}
                                                        title="Change Department"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        {['Executive', 'Engineering', 'Operations', 'Product', 'Marketing', 'Sales', 'Design', 'Research', 'Support', 'Quality Assurance'].map(dept => (
                                                            <option key={dept} value={dept} className="bg-zinc-950 text-zinc-300">{dept}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <span className="text-[10px] text-zinc-600 font-mono">| {cluster.collaborators.length} Nodes</span>
                                                <div className="relative group/budget">
                                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-text" title="Click to Edit Mission Budget">
                                                        <span className="text-xs text-blue-400 font-mono font-bold">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-20 bg-transparent border-none p-0 text-xs text-blue-400 font-mono font-bold focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            value={cluster.budgetUsd || 0}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateClusterBudget(cluster.id, parseFloat(e.target.value) || 0);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-700 rounded shadow-xl text-[9px] text-zinc-400 invisible group-hover/budget:visible z-50 pointer-events-none">
                                                        Swarm Treasury Allocation. Update to adjust resource priority.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleToggleActive(e, cluster.id)}
                                            className={`p-1 rounded hover:bg-zinc-800 transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`}
                                            title={isActive ? "Deactivate Mission" : "Set Active"}
                                        >
                                            <Zap size={12} fill={isActive ? "currentColor" : "none"} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteCluster(e, cluster.id)}
                                            className="p-1 rounded hover:bg-red-900/20 text-zinc-600 hover:text-red-400 transition-colors"
                                            title="Delete Cluster"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex -space-x-2 overflow-hidden relative z-10 p-1">
                                    {cluster.collaborators.slice(0, 5).map(id => {
                                        const agent = agents.find(a => a.id === id);
                                        const isAlpha = cluster.alphaId === id;
                                        const avatarColor = agent?.themeColor || (isAlpha ? '#f59e0b' : undefined);
                                        return (
                                            <div
                                                key={id}
                                                className={`w-7 h-7 rounded-full border-2 border-black flex items-center justify-center transition-colors relative`}
                                                style={{ backgroundColor: avatarColor ? `${avatarColor}30` : '#27272a', borderColor: avatarColor || '#3f3f46' }}
                                            >
                                                <span className="text-[10px] font-bold" style={{ color: avatarColor || '#a1a1aa' }}>
                                                    {agent?.name[0] || '?'}
                                                </span>
                                                {isAlpha && (
                                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-black shadow-[0_0_5px_rgba(245,158,11,0.8)]" title="Alpha Node" />
                                                )}
                                            </div>
                                        );
                                    })}
                                    {cluster.collaborators.length > 5 && (
                                        <div className="w-7 h-7 rounded-full border-2 border-black bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                                            +{cluster.collaborators.length - 5}
                                        </div>
                                    )}
                                </div>

                                {isActive && (
                                    <div className="absolute top-0 right-0 p-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Main Assignment Area */}
                <div className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
                    {activeCluster ? (
                        <>
                            <div className={`p-6 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur flex justify-between items-center relative overflow-hidden`}>
                                <div className={`absolute top-0 left-0 w-1 h-full ${getThemeColors(activeCluster!.theme).text.replace('text', 'bg')}`} />
                                <div>
                                    <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">{activeCluster!.name}</h2>
                                    <p className="text-xs text-zinc-500 mt-1">Cluster Root Path: <code className={`${getThemeColors(activeCluster!.theme).text}/80`}>{activeCluster!.path}</code></p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={async () => {
                                            if (!activeCluster?.alphaId) {
                                                EventBus.emit({
                                                    source: 'System',
                                                    text: `❌ Mission Failed: No Alpha Node designated for "${activeCluster?.name || 'Unknown'}". Promoted an agent to leader first.`,
                                                    severity: 'error'
                                                });
                                                return;
                                            }

                                            if (!activeCluster?.objective) {
                                                EventBus.emit({
                                                    source: 'System',
                                                    text: `❌ Mission Failed: Objective not defined for "${activeCluster?.name || 'Unknown'}".`,
                                                    severity: 'error'
                                                });
                                                return;
                                            }

                                            const alphaAgent = agents.find(a => a.id === activeCluster?.alphaId);
                                            if (!alphaAgent) {
                                                EventBus.emit({
                                                    source: 'System',
                                                    text: `❌ Critical Error: Alpha Node (ID: ${activeCluster?.alphaId}) not found in agent registry.`,
                                                    severity: 'error'
                                                });
                                                return;
                                            }

                                            EventBus.emit({
                                                source: 'System',
                                                text: `🚀 Launching Mission: ${activeCluster.objective}`,
                                                severity: 'warning'
                                            });

                                            try {
                                                const success = await OpenClawService.sendCommand(
                                                    alphaAgent.id,
                                                    activeCluster.objective,
                                                    activeCluster.id,
                                                    activeCluster.department // Pass department context
                                                );
                                                if (success) {
                                                    EventBus.emit({
                                                        source: 'System',
                                                        text: `✅ Mission dispatched to ${alphaAgent.name}.`,
                                                        severity: 'success'
                                                    });
                                                } else {
                                                    throw new Error("Engine rejected the command or failed to respond.");
                                                }
                                            } catch (err: any) {
                                                EventBus.emit({
                                                    source: 'System',
                                                    text: `❌ Mission Launch Failed: ${err.message}`,
                                                    severity: 'error'
                                                });
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${getThemeColors(activeCluster!.theme).border} bg-zinc-900 ${getThemeColors(activeCluster!.theme).text} hover:scale-105 active:scale-95 transition-all font-bold uppercase tracking-tighter shadow-lg ${getThemeColors(activeCluster!.theme).glow}`}
                                    >
                                        <Zap size={16} fill="currentColor" />
                                        RUN MISSION
                                    </button>
                                    <div className={`p-3 bg-zinc-900 rounded-xl border border-zinc-800 ${getThemeColors(activeCluster!.theme).text}`}>
                                        {(() => {
                                            const DeptImg = getDeptIcon(activeCluster!.department);
                                            return <DeptImg size={24} />;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar">
                                {/* Neural Suggestion Banner */}
                                {useWorkspaceStore.getState().activeProposals[activeCluster!.id] && (
                                    <div className={`p-4 rounded-xl border ${getThemeColors(activeCluster!.theme).bg} ${getThemeColors(activeCluster!.theme).border} animate-in slide-in-from-top-4 duration-500`}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex gap-4">
                                                <div className={`p-2 rounded-lg bg-zinc-900 border ${getThemeColors(activeCluster!.theme).border}`}>
                                                    <Cpu size={20} className={getThemeColors(activeCluster!.theme).text} />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-tight">Neural Swarm Optimization Proffered</h4>
                                                    <p className="text-xs text-zinc-400 font-mono leading-relaxed max-w-xl">
                                                        {useWorkspaceStore.getState().activeProposals[activeCluster!.id].reasoning}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => useWorkspaceStore.getState().dismissProposal(activeCluster!.id)}
                                                    className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-500 text-xs font-bold uppercase tracking-wider hover:text-zinc-300 transition-colors"
                                                >
                                                    Dismiss
                                                </button>
                                                <button
                                                    onClick={() => useWorkspaceStore.getState().applyProposal(activeCluster!.id)}
                                                    className={`px-3 py-1.5 rounded-lg border ${getThemeColors(activeCluster!.theme).text} ${getThemeColors(activeCluster!.theme).border} bg-zinc-900 text-xs font-bold uppercase tracking-wider hover:brightness-125 transition-all shadow-lg ${getThemeColors(activeCluster!.theme).glow}`}
                                                >
                                                    Authorize Sync
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeCluster!.pendingTasks.filter(t => t.id.startsWith('ho-') && t.status === 'pending').length > 0 && (
                                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 animate-pulse-subtle">
                                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Repeat size={12} /> Incoming Handoffs
                                        </h4>
                                        <div className="space-y-3">
                                            {activeCluster!.pendingTasks.filter(t => t.id.startsWith('ho-') && t.status === 'pending').map(task => (
                                                <div key={task.id} className="p-3 bg-black/40 border border-amber-500/20 rounded-lg flex items-center justify-between gap-4">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-xs text-zinc-100">{task.description}</p>
                                                        <span className="text-[8px] text-amber-500/60 uppercase font-mono">Mission Delegation Request</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => approveBranch(activeCluster!.id, task.id)}
                                                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => rejectBranch(activeCluster!.id, task.id)}
                                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Operational Objective */}
                                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Target size={12} className={getThemeColors(activeCluster!.theme).text} /> Operational Objective
                                    </h4>
                                    <textarea
                                        value={activeCluster!.objective || ''}
                                        onChange={(e) => updateClusterObjective(activeCluster!.id, e.target.value)}
                                        placeholder="Describe the cluster's collective mission..."
                                        className="bg-transparent text-sm text-zinc-300 border-none focus:ring-0 resize-none h-16 custom-scrollbar placeholder:text-zinc-700"
                                    />
                                </div>
                                {/* Assigned Agents */}
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Users size={12} /> Team Collaborators
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {activeCluster!.collaborators.map(id => {
                                            const agent = agents.find((a: any) => a.id === id);
                                            const isAlpha = activeCluster!.alphaId === id;
                                            const agentColor = agent?.themeColor || (activeCluster!.theme === 'cyan' ? '#06b6d4' : activeCluster!.theme === 'purple' ? '#a855f7' : activeCluster!.theme === 'amber' ? '#f59e0b' : '#3b82f6');

                                            return agent ? (
                                                <div
                                                    key={id}
                                                    className={`p-3 bg-zinc-900 border rounded-xl flex items-center justify-between group transition-all duration-300`}
                                                    style={{
                                                        borderColor: `${agentColor}${isAlpha ? '50' : '30'}`,
                                                        boxShadow: isAlpha ? `0 0 15px ${agentColor}20` : 'none'
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => setAlphaNode(activeCluster!.id, id)}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all`}
                                                            style={{
                                                                borderColor: `${agentColor}${isAlpha ? '50' : '30'}`,
                                                                backgroundColor: `${agentColor}10`
                                                            }}
                                                            title={isAlpha ? "Alpha Node (Leader)" : "Promote to Alpha Node"}
                                                        >
                                                            {isAlpha ? (
                                                                <Crown size={14} style={{ color: agentColor }} />
                                                            ) : (
                                                                <div className="relative flex items-center justify-center">
                                                                    <span className="text-xs font-mono font-bold group-hover:opacity-0 transition-opacity" style={{ color: agentColor }}>{agent.name[0]}</span>
                                                                    <Crown size={12} className="absolute opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: agentColor }} />
                                                                </div>
                                                            )}
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-zinc-200">{agent.name}</span>
                                                                {isAlpha && <Crown size={10} className="text-amber-400 fill-amber-400/20" />}
                                                                {isAlpha && (
                                                                    <span
                                                                        className="text-[8px] px-1 rounded uppercase font-bold tracking-tighter border"
                                                                        style={{
                                                                            color: agentColor,
                                                                            borderColor: `${agentColor}40`,
                                                                            backgroundColor: `${agentColor}15`
                                                                        }}
                                                                    >
                                                                        Alpha
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-zinc-500 font-mono uppercase">{agent.role}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(id)}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                {/* Available Agents */}
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Plus size={12} /> Assign New Agents
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {availableAgents.length > 0 ? availableAgents.map(agent => {
                                            const agentColor = agent.themeColor || '#3b82f6';
                                            return (
                                                <button
                                                    key={agent.id}
                                                    onClick={() => handleAssign(agent.id)}
                                                    className="p-3 bg-zinc-900/50 border border-dashed rounded-xl flex items-center gap-3 text-left transition-all group hover:brightness-110"
                                                    style={{ borderColor: `${agentColor}30` }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${agentColor}60`; e.currentTarget.style.backgroundColor = `${agentColor}08`; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${agentColor}30`; e.currentTarget.style.backgroundColor = ''; }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors"
                                                        style={{ borderColor: `${agentColor}40`, backgroundColor: `${agentColor}10` }}
                                                    >
                                                        <Plus size={14} style={{ color: agentColor }} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">{agent.name}</span>
                                                        <span className="text-[11px] text-zinc-600 uppercase">{agent.role}</span>
                                                    </div>
                                                </button>
                                            );
                                        }) : (
                                            <div className="col-span-full py-8 text-center text-zinc-600 text-xs italic border border-zinc-800 border-dashed rounded-2xl">
                                                All available agents have been deployed.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4">
                            <Target size={48} className="opacity-10" />
                            <p className="text-sm italic">Select a Mission Cluster to manage assignments.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
