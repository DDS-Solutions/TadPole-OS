import React from 'react';
import { Activity, Cpu, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../services/workspaceStore';
import { agents as allAgents } from '../data/mockAgents';

interface SwarmOversightNodeProps {
    className?: string;
}

export const SwarmOversightNode: React.FC<SwarmOversightNodeProps> = ({ className = '' }) => {
    const { activeProposals, clusters } = useWorkspaceStore();
    const proposals = Object.values(activeProposals);

    if (proposals.length === 0) return null;

    return (
        <div className={`flex flex-col gap-4 w-[400px] ${className}`}>
            {proposals.map((proposal) => {
                const cluster = clusters.find(c => c.id === proposal.clusterId);
                return (
                    <div key={proposal.clusterId} className="relative group">
                        {/* Connecting Line to Parent Node */}
                        <div className="absolute -top-6 left-8 w-px h-6 bg-blue-500/30 group-hover:bg-blue-500/60 transition-colors"></div>
                        <div className="absolute -top-6 left-8 -ml-[3px] w-[7px] h-[7px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>

                        <div className="bg-zinc-950 border border-blue-500/30 rounded-xl overflow-hidden shadow-2xl relative z-10">
                            {/* Header */}
                            <div className="bg-blue-500/10 px-4 py-2 border-b border-blue-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Cpu size={14} className="text-blue-400" />
                                    <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">
                                        Swarm Oversight • {cluster?.name || 'Cluster'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[9px] font-mono text-blue-300/70">
                                        {new Date(proposal.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Reasoning Trace */}
                                <div className="bg-black/40 p-3 rounded-lg border border-zinc-800/50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                                    <div className="text-[9px] font-bold text-zinc-500 mb-1.5 uppercase tracking-wide flex items-center gap-2">
                                        <Activity size={10} className="text-blue-500" /> Neural Reasoning Trace
                                    </div>
                                    <p className="text-[10px] text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap opacity-90">
                                        {proposal.reasoning}
                                    </p>
                                </div>

                                {/* Proposed Changes */}
                                <div>
                                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <ArrowRight size={10} /> Optimization Strategy
                                    </div>
                                    <div className="space-y-2">
                                        {proposal.changes.map(change => {
                                            const agent = allAgents.find(a => a.id === change.agentId);
                                            return (
                                                <div key={change.agentId} className="p-2 bg-zinc-900/50 border border-zinc-800 rounded mx-1 hover:border-zinc-700 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[10px] font-bold text-zinc-200">{agent?.name || change.agentId}</span>
                                                        <span className="text-[8px] px-1 rounded bg-blue-900/20 text-blue-300 border border-blue-500/20 font-mono uppercase">MODIFIED</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                        {change.proposedRole && (
                                                            <div className="flex items-center gap-1.5 text-[9px]">
                                                                <span className="text-zinc-500">Role:</span>
                                                                <span className="text-blue-400 font-mono">{change.proposedRole}</span>
                                                            </div>
                                                        )}
                                                        {change.proposedModel && (
                                                            <div className="flex items-center gap-1.5 text-[9px]">
                                                                <span className="text-zinc-500">Model:</span>
                                                                <span className="text-purple-400 font-mono">{change.proposedModel}</span>
                                                            </div>
                                                        )}
                                                        {change.addedSkills && (
                                                            <div className="flex items-center gap-1.5 text-[9px] col-span-2">
                                                                <span className="text-zinc-500">Skills:</span>
                                                                <span className="text-emerald-400 font-mono">+{change.addedSkills.length} new capabilities</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Decorator */}
                            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
