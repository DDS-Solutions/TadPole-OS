import { useState, useEffect, useRef, useMemo } from 'react';
import { agents as initialAgents } from '../data/mockAgents';
import { loadAgents, persistAgentUpdate, normalizeAgent } from '../services/agentService';
import { OpenClawService } from '../services/openclawService';
import { Activity, Zap, Users, Clock, Shield, Terminal, Rocket, Loader2 } from 'lucide-react';

import { HierarchyNode } from '../components/HierarchyNode';
import TerminalComponent from '../components/Terminal';
import AgentConfigPanel from '../components/AgentConfigPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { openClawSocket } from '../services/openclawSocket';
import { EventBus, type LogEntry } from '../services/eventBus';
import { useEngineStatus } from '../hooks/useEngineStatus';
import type { Agent } from '../types';
import { useWorkspaceStore } from '../services/workspaceStore';
import { useRoleStore } from '../services/roleStore';
import { useDropdownStore } from '../services/dropdownStore';


/**
 * OpsDashboard
 * 
 * The central command-and-control center for the Tadpole OS agent swarm.
 * Multiplexes real-time telemetry, agent status, and system logs into a
 * unified Glassmorphic interface.
 *
 * Capabilities:
 * - Neural Heartbeat monitoring (CPU, Latency, Token Burn).
 * - Dynamic Role and Model hot-swapping via HierarchyNode integration.
 * - Integrated system terminal for raw event observability.
 * - Automated deployment triggers for remote sandbox synchronization.
 */
export default function OpsDashboard() {
    const { isOnline, agentsCount } = useEngineStatus();
    const [agentsList, setAgentsList] = useState<typeof initialAgents>([]);
    const [logs, setLogs] = useState<LogEntry[]>(() => EventBus.getHistory());
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    useEffect(() => {
        // Load agents (either mock or from OpenClaw)
        const fetchAgents = async () => {
            const data = await loadAgents();
            // Merge: live agents override mock agents, but keep ALL mock agents in state
            const liveIds = new Set(data.map(a => a.id));
            const merged = [
                ...data,
                ...initialAgents.filter(ma => !liveIds.has(ma.id))
            ];
            setAgentsList(merged);
        };
        fetchAgents();

        // Subscribe to EventBus for system logs
        // Initialize with current history
        // Subscribe to EventBus for system logs

        const unsubscribeLogs = EventBus.subscribe((entry) => {
            setLogs(prev => [...prev, entry].slice(-100)); // Keep last 100 in UI to prevent lag
        });

        const unsubscribeUpdates = openClawSocket.subscribeAgentUpdates((event) => {
            if (event.type === 'agent:update' && event.agentId && event.data) {
                // Re-read overrides to ensure consistency in the merge
                const overridesRaw = localStorage.getItem('tadpole-agent-overrides');
                const overrides = overridesRaw ? JSON.parse(overridesRaw) : {};

                // Resolve workspace path using the store to maintain parity with loadAgents
                const workspacePath = useWorkspaceStore.getState().getAgentPath(event.agentId);
                const normalizedAgent = normalizeAgent(event.data, overrides, workspacePath);

                setAgentsList(prev => prev.map(a =>
                    a.id === event.agentId ? normalizedAgent : a
                ));
            }
        });

        return () => {
            unsubscribeLogs();
            unsubscribeUpdates();
        };
    }, []);

    const [configAgentId, setConfigAgentId] = useState<string | null>(null);

    /** Applies config updates from the AgentConfigPanel back to the local agents list. */
    const handleAgentUpdate = (agentId: string, updates: Partial<Agent>) => {
        setAgentsList(prev => prev.map(a =>
            a.id === agentId ? { ...a, ...updates } : a
        ));
        persistAgentUpdate(agentId, updates);
    };

    const { clusters } = useWorkspaceStore();
    const assignedAgentIds = new Set(clusters.filter(c => c.isActive).flatMap(c => c.collaborators));

    const roles = useRoleStore(s => s.roles);
    const availableRoles = useMemo(() => Object.keys(roles).sort(), [roles]);
    const activeAgents = agentsList.filter(a => (a.status === 'active' || a.status === 'speaking') && assignedAgentIds.has(a.id)).length;
    const totalCost = agentsList.reduce((acc, curr) => acc + (curr.costUsd || 0), 0);
    const totalBudget = agentsList.reduce((acc, curr) => acc + (curr.budgetUsd || 0), 0);
    const budgetUtil = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0;

    // ── Handlers ──────────────────────────────────────────────
    const handleRoleChange = (agentId: string, newRole: string) => {
        const roles = useRoleStore.getState().roles;
        const newActions = roles[newRole] || { capabilities: [], workflows: [] };
        handleAgentUpdate(agentId, {
            role: newRole,
            capabilities: newActions.capabilities,
            workflows: newActions.workflows
        });
    };
    const handleSkillTrigger = async (agentId: string, skill: string, slot: 1 | 2 | 3 = 1) => {
        const agent = agentsList.find(a => a.id === agentId);
        if (!agent) return;

        setAgentsList(prev => prev.map(a => {
            if (a.id === agentId) return {
                ...a,
                status: 'active' as const,
                currentTask: `⚡ Executing: ${skill}...`,
                activeWorkflow: skill,
                activeModelSlot: slot
            };
            return a;
        }));

        // ACTUALLY send the command to the backend
        const objective = `Execute skill: ${skill}`;

        let modelId = agent.model;
        let provider = agent.modelConfig?.provider;

        if (slot === 2) {
            modelId = agent.model2 || modelId;
            provider = agent.modelConfig2?.provider || provider;
        } else if (slot === 3) {
            modelId = agent.model3 || modelId;
            provider = agent.modelConfig3?.provider || provider;
        }

        try {
            const agentCluster = clusters.find(c => c.collaborators.includes(agentId));
            await OpenClawService.sendCommand(agentId, objective, agentCluster?.id, agent.department, modelId, provider, agentCluster?.budgetUsd);
        } catch (e) {
            console.error("❌ [Gateway] Failed to trigger skill:", e);
            EventBus.emit({
                text: `Failed to trigger skill ${skill} for ${agent.name}: ${e}`,
                severity: 'error',
                source: 'System'
            });
        }
    };
    const handleModelChange = (agentId: string, newModel: string) => {
        const provider = OpenClawService.resolveProvider(newModel);
        handleAgentUpdate(agentId, { model: newModel, modelConfig: { modelId: newModel, provider } });
    };
    const handleModel2Change = (agentId: string, newModel: string) => {
        const provider = OpenClawService.resolveProvider(newModel);
        handleAgentUpdate(agentId, { model2: newModel, modelConfig2: { modelId: newModel, provider } });
    };
    const handleModel3Change = (agentId: string, newModel: string) => {
        const provider = OpenClawService.resolveProvider(newModel);
        handleAgentUpdate(agentId, { model3: newModel, modelConfig3: { modelId: newModel, provider } });
    };
    const closeDropdowns = useDropdownStore(s => s.close);

    const handleDeploy = async () => {
        setIsDeploying(true);
        EventBus.emit({ text: 'Starting deployment to Swarm Bunker (Linux or Similar Sandbox for Production Deployment) via deploy.ps1...', severity: 'info', source: 'System' });
        try {
            // Read the API token from the settings store — same key used by all other
            // authenticated engine calls. If no token is configured, the deploy request
            // will correctly return 401, prompting the operator to set it in Settings.
            const { getSettings } = await import('../services/settingsStore');
            const token = getSettings().openClawApiKey || '';


            // Explicitly hit the local dev backend where the code resides, not the remote engine!
            const url = 'http://localhost:8000/engine/deploy';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                EventBus.emit({ text: `Deployment successful. Output length: ${data.output?.length} bytes.`, severity: 'success', source: 'System' });
            } else {
                EventBus.emit({ text: `Deployment failed: ${data.error || 'Unknown error'}`, severity: 'error', source: 'System' });
            }
        } catch (e) {
            EventBus.emit({ text: `Deployment error: ${e}`, severity: 'error', source: 'System' });
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-full gap-6">
                {/* Standardized Module Header */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2 px-1 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                            <Activity className="text-blue-500" /> OPERATIONS CENTER
                        </h1>
                        <p className="text-xs text-zinc-500 font-mono mt-1 tracking-wide uppercase">
                            ACTIVE AGENTS: {agentsList.filter(a => a.status !== 'offline' && assignedAgentIds.has(a.id)).length}/25 •
                            ACTIVE CLUSTERS: {clusters.filter(c => c.isActive).length}/10 •
                            ACTIVE MISSIONS: {agentsList.filter(a => !!a.activeMission).length}/20
                        </p>
                    </div>
                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                        title="Push current code to the Swarm Bunker (Linux or Similar Sandbox for Production Deployment)"
                    >
                        {isDeploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                        {isDeploying ? 'DeployING...' : 'DEPLOY TO SWARM BUNKER'}
                    </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 flex-1 min-h-0 text-sm overflow-hidden" onClick={closeDropdowns}>

                    {/* 1. Main Agent Grid (Left) */}
                    <div className="xl:col-span-3 flex flex-col gap-6 overflow-hidden">
                        {/* Metric Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
                            {[
                                { label: 'Active Swarm', value: isOnline ? `${activeAgents}/${agentsCount || agentsList.length}` : `${activeAgents}/${agentsList.length}`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-900/10' },
                                { label: 'Swarm Cost', value: `$${totalCost.toFixed(3)}`, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-900/10' },
                                { label: 'Swarm Capacity', value: `${budgetUtil.toFixed(1)}%`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-900/10' },
                                { label: 'System Health', value: isOnline ? 'ONLINE' : 'OFFLINE', icon: Shield, color: isOnline ? 'text-emerald-400' : 'text-zinc-600', bg: isOnline ? 'bg-emerald-900/10' : 'bg-zinc-900/10' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
                                    <div className="neural-grid opacity-[0.03]" />
                                    <div className="relative z-10">
                                        <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">{stat.label}</div>
                                        <div className={`text-2xl font-bold mt-1 ${stat.color} font-mono`}>{stat.value}</div>
                                    </div>
                                    <div className={`relative z-10 p-2.5 rounded-lg ${stat.bg} ${stat.color} border border-white/5 transition-transform duration-300 group-hover:scale-110`}>
                                        <stat.icon size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Live Activity Stream removed to Oversight */}

                        {/* Agent Grid */}
                        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl px-6 pb-6 custom-scrollbar relative">
                            <div className="neural-grid opacity-[0.1]" />
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6 sticky top-0 bg-zinc-950/80 backdrop-blur-md pt-6 pb-3 border-b border-zinc-800/50 z-20 flex items-center gap-2">
                                <Activity size={12} className="text-blue-500" /> Live Agent Status
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-4 relative z-10">
                                {agentsList
                                    .filter(agent => assignedAgentIds.has(agent.id))
                                    .map(agent => {
                                        const agentColor = agent.themeColor || '#10b981';

                                        return (
                                            <div key={agent.id} className="agent-grid-item group/item relative">
                                                {/* Ambient Glow (Mirroring OrgChart) */}
                                                <div
                                                    className="absolute -inset-4 blur-3xl rounded-full opacity-0 group-hover/item:opacity-20 transition-opacity duration-700 pointer-events-none"
                                                    style={{ backgroundColor: agentColor }}
                                                />

                                                <HierarchyNode
                                                    agent={agent}
                                                    availableRoles={availableRoles}
                                                    onSkillTrigger={handleSkillTrigger}
                                                    onConfigureClick={(id) => setConfigAgentId(id)}
                                                    isAlpha={clusters.find(c => c.collaborators.includes(agent.id))?.alphaId === agent.id}
                                                    isActive={clusters.find(c => c.collaborators.includes(agent.id))?.isActive}
                                                    missionObjective={clusters.find(c => c.collaborators.includes(agent.id))?.objective || agent.activeMission?.objective}
                                                    onModelChange={handleModelChange}
                                                    onModel2Change={handleModel2Change}
                                                    onModel3Change={handleModel3Change}
                                                    onRoleChange={handleRoleChange}
                                                    onUpdate={handleAgentUpdate}
                                                />
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* 2. Task Manager / System Log (Right) */}
                    <div className="xl:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col overflow-hidden shadow-lg relative group">
                        <div className="neural-grid opacity-[0.05]" />
                        <div className="relative z-10 p-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <Terminal size={12} /> System Log
                            </h3>
                            {/* Auto-scroll indicator or status could go here */}
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700"></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] custom-scrollbar">
                            {logs.length === 0 && (
                                <div className="text-zinc-600 italic text-center mt-10">Waiting for system events...</div>
                            )}
                            {logs.map((log) => (
                                <div key={log.id} className="space-y-1 group animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-500 text-[10px]">{log.timestamp.toLocaleTimeString([], { hour12: false })}</span>
                                        {log.agentId ? (
                                            <span className="text-blue-400 font-bold">[{log.source}:{log.agentId}]</span>
                                        ) : (
                                            <span className="text-purple-400 font-bold">[{log.source}]</span>
                                        )}
                                    </div>
                                    <div className={`pl-2 border-l-2 ${log.severity === 'error' ? 'border-red-500 text-red-400' :
                                        log.severity === 'success' ? 'border-emerald-500 text-emerald-400' :
                                            log.severity === 'warning' ? 'border-amber-500 text-amber-400' :
                                                'border-zinc-800 text-zinc-300'
                                        }`}>
                                        {log.text}
                                    </div>
                                </div>
                            ))}
                            {/* Dummy div to scroll to */}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Agent Config Panel Overlay */}
                    {configAgentId && (() => {
                        const agent = agentsList.find(a => a.id === configAgentId);
                        return agent ? (
                            <AgentConfigPanel
                                agent={agent}
                                onClose={() => setConfigAgentId(null)}
                                onUpdate={handleAgentUpdate}
                            />
                        ) : null;
                    })()}

                    {/* Terminal Interface */}
                    <TerminalComponent agents={agentsList} />
                </div>
            </div>
        </ErrorBoundary>
    );
}
