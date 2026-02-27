import React from 'react';
import { Shield, Database, Layout, PenTool, TrendingUp, Users, Zap, Sliders, Crown, Target, ChevronDown, Terminal, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModelBadge } from './ModelBadge';
import { getModelColor } from '../utils/modelUtils';
import { SwarmOversightNode } from './SwarmOversightNode';
import { useProviderStore } from '../services/providerStore';
import { useDropdownStore } from '../services/dropdownStore';
import type { Agent } from '../types';

const DEPARTMENT_ICONS: Record<string, React.ElementType> = {
    'Executive': Shield,
    'Engineering': Layout,
    'Product': PenTool,
    'Sales': TrendingUp,
    'Operations': Database,
};


/**
 * Props for the HierarchyNode component.
 */
interface HierarchyNodeProps {
    agent?: Agent;
    isRoot?: boolean;
    onSkillTrigger?: (agentId: string, skill: string, slot?: 1 | 2 | 3) => void;
    onConfigureClick?: (agentId: string) => void;
    isAlpha?: boolean;
    isActive?: boolean;
    missionObjective?: string;
    themeColor?: string;
    onModelChange?: (agentId: string, newModel: string) => void;
    onModel2Change?: (agentId: string, newModel: string) => void;
    onModel3Change?: (agentId: string, newModel: string) => void;
    onRoleChange?: (agentId: string, newRole: string) => void;
    onUpdate?: (agentId: string, updates: Partial<Agent>) => void;
    availableRoles?: string[];
}

/**
 * A specialized agent card component designed for the Neural Command Hierarchy.
 * Features status indicators, mission data, and per-model configuration badges.
 */
const HierarchyNodeBase: React.FC<HierarchyNodeProps> = ({
    agent,
    isRoot = false,
    onSkillTrigger,
    onConfigureClick,
    isAlpha = false,
    isActive = false,
    missionObjective,
    onModelChange,
    onModel2Change,
    onModel3Change,
    onRoleChange,
    onUpdate,
    availableRoles = [],
}): React.ReactElement | null => {
    const toggle = useDropdownStore(s => s.toggle);
    const close = useDropdownStore(s => s.close);

    const isRoleDropdownOpen = useDropdownStore(s => s.openId === agent?.id && s.openType === 'role');
    const isSkillDropdownOpen = useDropdownStore(s => s.openId === agent?.id && s.openType === 'skill');
    const isModel1Open = useDropdownStore(s => s.openId === agent?.id && s.openType === 'model');
    const isModel2Open = useDropdownStore(s => s.openId === agent?.id && s.openType === 'model2');
    const isModel3Open = useDropdownStore(s => s.openId === agent?.id && s.openType === 'model3');

    const availableModels = useProviderStore(s => s.models);
    const sortedModelNames = React.useMemo(() =>
        Array.from(new Set(availableModels.map(m => m.name))).sort(),
        [availableModels]);

    const modelSlots = React.useMemo(() => [
        { label: 'Primary', model: agent?.model, config: agent?.modelConfig },
        { label: 'Secondary', model: agent?.model2, config: agent?.modelConfig2 },
        { label: 'Tertiary', model: agent?.model3, config: agent?.modelConfig3 },
    ].filter(s => s.model), [agent?.model, agent?.model2, agent?.model3, agent?.modelConfig, agent?.modelConfig2, agent?.modelConfig3]);

    if (!agent) return null;

    const isAnyDropdownOpen = isRoleDropdownOpen || isSkillDropdownOpen || isModel1Open || isModel2Open || isModel3Open;
    const Icon = (agent.department && DEPARTMENT_ICONS[agent.department]) || Users;

    const toggleRoleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggle(agent.id, 'role');
    };

    const agentColor = agent.themeColor || '#10b981';

    const roleBadgeClass =
        agent.department === 'Executive' ? 'text-purple-400 border-purple-900 bg-purple-900/10' :
            agent.department === 'Engineering' ? 'text-blue-400 border-blue-900 bg-blue-900/10' :
                agent.department === 'Product' ? 'text-orange-400 border-orange-900 bg-orange-900/10' :
                    'text-zinc-400 border-zinc-800 bg-zinc-900';

    return (
        <div className={`relative group transition-all duration-300 w-full ${isAnyDropdownOpen ? 'z-[100]' : 'z-0'}`}>
            <div
                className={`
                    relative z-10 p-3 rounded-xl border backdrop-blur-xl transition-all duration-300
                    bg-[#1b1b1e]/60
                    ${agent.status !== 'offline' && agent.status !== 'idle' ? 'border-zinc-800' : 'border-zinc-800/30'}
                    hover:border-zinc-600 hover:scale-[1.02] active:scale-[0.98]
                    overflow-visible flex flex-col gap-3 shadow-2xl
                `}
                style={{
                    borderColor: `${agentColor}30`,
                    boxShadow: `0 0 15px ${agentColor}10`,
                    color: agentColor
                }}
            >
                {/* Header: Name + Status */}
                <div className={`flex justify-between items-start ${isRoleDropdownOpen ? 'z-50' : 'z-20'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center border transition-all relative
                            ${isAlpha ? 'bg-zinc-900 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : (agent?.status !== 'offline' && agent?.status !== 'idle' ? 'bg-zinc-900 border-white/10' : 'bg-zinc-950 border-white/5')}
                        `}>
                            {/* Neural Pulse Ring */}
                            {agent?.status !== 'offline' && agent?.status !== 'idle' && (
                                <div className="absolute inset-0 rounded-lg animate-ping opacity-20 border border-current" style={{ backgroundColor: 'transparent', borderColor: agentColor }} />
                            )}
                            {isAlpha ? (
                                <Crown size={14} className="text-amber-500 animate-pulse" />
                            ) : (
                                <Icon size={14} className={agent?.status !== 'offline' && agent?.status !== 'idle' ? '' : 'opacity-40'} />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-100 text-xs tracking-tight leading-none">{agent.name}</span>
                                {isAlpha && <Crown size={10} className="text-amber-400 fill-amber-400/20" />}
                            </div>
                            {/* Role Dropdown (Mirrored) */}
                            <div className="relative mt-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={toggleRoleDropdown}
                                    className={`text-[11px] px-1.5 py-0.5 rounded border font-mono flex items-center gap-1 hover:bg-white/5 transition-colors cursor-pointer ${roleBadgeClass}`}>
                                    {agent.role.toUpperCase()}
                                    <ChevronDown size={8} className="opacity-70" />
                                </button>

                                {isRoleDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {availableRoles.map((role) => (
                                            <button
                                                key={role}
                                                onClick={() => {
                                                    onRoleChange?.(agent.id, role);
                                                    close();
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${agent.role === role ? 'text-blue-400 font-bold bg-blue-900/10' : 'text-zinc-300'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isActive && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-in fade-in zoom-in-95">
                                <Zap size={8} fill="currentColor" /> Active
                            </div>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfigureClick?.(agent.id); }}
                            className="p-1 rounded hover:bg-blue-900/20 text-zinc-600 hover:text-blue-400 transition-colors"
                            title="Configure Node"
                        >
                            <Sliders size={12} />
                        </button>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 transition-all duration-500 ${agent?.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                            agent?.status === 'thinking' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' :
                                agent?.status === 'coding' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse' :
                                    agent?.status === 'speaking' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse' :
                                        'bg-zinc-700'
                            }`} />
                    </div>
                </div>

                {/* Metrics & Skills Row */}
                <div className={`flex items-center justify-between px-1 py-1 border-b border-zinc-800/30 relative ${isSkillDropdownOpen ? 'z-50' : 'z-30'}`}>
                    <div className="flex items-center gap-2">
                        {/* Quick Actions (Zap Icon) */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => toggle(agent.id, 'skill')}
                                className={`p-1 rounded hover:bg-zinc-800 transition-colors ${isSkillDropdownOpen ? 'text-blue-400 bg-blue-900/10' : 'text-zinc-600 hover:text-zinc-300'}`}
                                title="Skills & Workflows"
                            >
                                <Zap size={14} fill={isSkillDropdownOpen ? "currentColor" : "none"} />
                            </button>

                            {isSkillDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.5)] z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-80 overflow-y-auto custom-scrollbar relative">
                                    <div className="neural-grid opacity-10 pointer-events-none" />
                                    <div className="relative z-10 w-full flex flex-col">
                                        {modelSlots.map((slot, idx) => {
                                            const skills = slot.config?.skills ?? (idx === 0 ? agent.capabilities : undefined) ?? [];
                                            const workflows = slot.config?.workflows ?? (idx === 0 ? agent.workflows : undefined) ?? [];
                                            if (!skills.length && !workflows.length) return null;

                                            return (
                                                <div key={slot.label} className={idx > 0 ? 'border-t border-zinc-800' : ''}>
                                                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest bg-zinc-950/60 border-b border-zinc-800/50 flex items-center justify-between gap-2">
                                                        <span className="text-zinc-500">{slot.label}</span>
                                                        <span className={`font-mono truncate ${getModelColor(slot.model || '').split(' ').find(c => c.startsWith('text-')) || 'text-zinc-400'}`}>
                                                            {slot.model}
                                                        </span>
                                                    </div>

                                                    {skills.length > 0 && (
                                                        <React.Fragment key={`${slot.label}-skills`}>
                                                            <div className="px-4 py-1.5 text-[9px] uppercase font-bold text-zinc-600 tracking-[0.2em] flex items-center gap-1.5 bg-zinc-950/80">
                                                                <Terminal size={10} className="text-blue-500" /> ACTIVE SKILLS
                                                            </div>
                                                            {skills.map((skill) => (
                                                                <button key={`${slot.label}-s-${skill}`} onClick={() => onSkillTrigger?.(agent.id, skill, (idx + 1) as 1 | 2 | 3)}
                                                                    className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-900 border-l-2 border-transparent hover:border-emerald-500 hover:text-white transition-all flex items-center gap-2 group font-mono">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 group-hover:bg-emerald-400 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all"></div>
                                                                    <span className="truncate">{skill}</span>
                                                                </button>
                                                            ))}
                                                        </React.Fragment>
                                                    )}

                                                    {workflows.length > 0 && (
                                                        <React.Fragment key={`${slot.label}-workflows`}>
                                                            <div className="px-4 py-1.5 mt-1 border-t border-zinc-800/30 text-[9px] uppercase font-bold text-zinc-600 tracking-[0.2em] flex items-center gap-1.5 bg-zinc-950/80">
                                                                <FileText size={10} className="text-purple-400" /> PASSIVE WORKFLOWS
                                                            </div>
                                                            {workflows.map((wf) => (
                                                                <button key={`${slot.label}-w-${wf}`} onClick={() => onSkillTrigger?.(agent.id, wf, (idx + 1) as 1 | 2 | 3)}
                                                                    className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-900 border-l-2 border-transparent hover:border-amber-500 hover:text-white transition-all flex items-center gap-2 group font-mono">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30 group-hover:bg-amber-400 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all"></div>
                                                                    <span className="truncate">{wf}</span>
                                                                </button>
                                                            ))}
                                                        </React.Fragment>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Skills & Workflows</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 font-mono text-xs text-emerald-500/80">
                            ${(agent.costUsd || 0).toFixed(3)}
                        </div>
                        <div className="w-px h-2.5 bg-zinc-800" />
                        <div className="flex items-center gap-1 font-mono text-xs text-zinc-500">
                            {(agent.tokensUsed / 1000).toFixed(1)}k
                        </div>
                    </div>
                </div>

                {/* Mission Badge area - Fixed height to prevent layout shift */}
                <div className="min-h-[26px] py-0.5 flex items-center justify-between z-20">
                    {(missionObjective || agent.activeMission) ? (
                        <Link to="/missions" className={`
                        text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-start gap-1 hover:brightness-125 transition-all no-underline cursor-pointer max-h-[60px] overflow-y-auto custom-scrollbar
                        ${isActive ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30' :
                                agent.activeMission?.priority === 'high' ? 'text-red-400 border-red-900/50 bg-red-950/30' :
                                    agent.activeMission?.priority === 'medium' ? 'text-amber-400 border-amber-900/50 bg-amber-950/30' :
                                        'text-emerald-400 border-emerald-900/50 bg-emerald-950/30'}
                    `}>
                            <Target size={8} className="animate-pulse fill-current mt-0.5 shrink-0" />
                            <span className="uppercase tracking-tighter">Mission: {missionObjective || agent.activeMission?.objective}</span>
                        </Link>
                    ) : (
                        <div className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-zinc-800/30 bg-zinc-900/5 text-zinc-600/50 flex items-center gap-1 italic">
                            <Shield size={8} className="opacity-20" />
                            <span className="uppercase tracking-tighter">No Active Mission</span>
                        </div>
                    )}

                    {/* Cluster Hub indicator if in a shared workspace */}
                    {agent.workspacePath?.includes('shared') && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-blue-400/60 uppercase animate-in fade-in slide-in-from-right-2">
                            <Users size={10} strokeWidth={3} />
                            <span>Cluster Hub</span>
                        </div>
                    )}
                </div>

                {/* Current Task Box */}
                <div className={`
                    text-xs min-h-[42px] leading-tight p-2 rounded-lg border z-10 transition-colors
                    ${agent.activeMission || agent.status === 'active' ? 'bg-black/40 text-zinc-300 border-zinc-800' : 'bg-black/20 text-zinc-500 border-zinc-800/50'}
                `}>
                    {agent.currentTask || <span className="italic opacity-50 font-mono text-[10px]">System Idle • Standing By...</span>}
                </div>

                {/* Model Badges (Interactive Picker) */}
                <div className={`flex flex-col gap-1.5 border-t border-zinc-800 pt-2 relative ${isModel1Open || isModel2Open || isModel3Open ? 'z-50' : isSkillDropdownOpen ? 'z-10' : 'z-20'}`}>
                    <div className="flex items-center gap-1.5 overflow-visible">
                        {/* Model 1 */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (agent.activeModelSlot !== 1) {
                                        onUpdate?.(agent.id, { activeModelSlot: 1 });
                                    }
                                }}
                                className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer z-30 group/led"
                                title="Activate Neural Slot 1"
                            >
                                <div className={`
                                    w-1.5 h-1.5 rounded-full transition-all duration-300
                                    ${(agent.activeModelSlot === 1 || (!agent.activeModelSlot && agent.status !== 'idle' && agent.status !== 'offline'))
                                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] scale-110'
                                        : 'bg-zinc-800 group-hover/led:bg-zinc-700'}
                                `} />
                            </button>
                            <ModelBadge
                                model={agent.model}
                                isActive={agent.activeModelSlot === 1 || (!agent.activeModelSlot && agent.status !== 'idle' && agent.status !== 'offline')}
                                onClick={() => toggle(agent.id, 'model')}
                            />
                            {isModel1Open && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {sortedModelNames.map((model) => (
                                        <button key={model} onClick={() => {
                                            onModelChange?.(agent.id, model);
                                            close();
                                        }}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${agent.model === model ? 'text-emerald-400 font-bold bg-emerald-900/10' : 'text-zinc-300'}`}>
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model 2 */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (agent.activeModelSlot !== 2) {
                                        onUpdate?.(agent.id, { activeModelSlot: 2 });
                                    }
                                }}
                                className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer z-30 group/led"
                                title="Activate Neural Slot 2"
                            >
                                <div className={`
                                    w-1.5 h-1.5 rounded-full transition-all duration-300
                                    ${agent.activeModelSlot === 2
                                        ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] scale-110'
                                        : 'bg-zinc-800 group-hover/led:bg-zinc-700'}
                                `} />
                            </button>
                            <ModelBadge
                                model={agent.model2 || "Add"}
                                isActive={agent.activeModelSlot === 2}
                                onClick={() => toggle(agent.id, 'model2')}
                            />
                            {isModel2Open && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {sortedModelNames.map((model) => (
                                        <button key={model} onClick={() => {
                                            onModel2Change?.(agent.id, model);
                                            close();
                                        }}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${agent.model2 === model ? 'text-purple-400 font-bold bg-purple-900/10' : 'text-zinc-300'}`}>
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model 3 */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (agent.activeModelSlot !== 3) {
                                        onUpdate?.(agent.id, { activeModelSlot: 3 });
                                    }
                                }}
                                className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer z-30 group/led"
                                title="Activate Neural Slot 3"
                            >
                                <div className={`
                                    w-1.5 h-1.5 rounded-full transition-all duration-300
                                    ${agent.activeModelSlot === 3
                                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] scale-110'
                                        : 'bg-zinc-800 group-hover/led:bg-zinc-700'}
                                `} />
                            </button>
                            <ModelBadge
                                model={agent.model3 || "Add"}
                                isActive={agent.activeModelSlot === 3}
                                onClick={() => toggle(agent.id, 'model3')}
                            />
                            {isModel3Open && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {sortedModelNames.map((model) => (
                                        <button key={model} onClick={() => {
                                            onModel3Change?.(agent.id, model);
                                            close();
                                        }}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${agent.model3 === model ? 'text-amber-400 font-bold bg-amber-900/10' : 'text-zinc-300'}`}>
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Point Indicators */}
            {!isRoot && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-current bg-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-current bg-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Background Decorative Element */}
            <div
                className={`
                    absolute -inset-0.5 rounded-xl blur-lg transition-opacity duration-500 -z-0
                    ${agent.status === 'active' ? 'opacity-30' : 'opacity-0'}
                `}
                style={{ backgroundColor: agentColor }}
            />

            {/* Swarm Oversight Integration (Alpha Only) */}
            {isAlpha && (
                <div className="absolute top-0 -right-[450px] pointer-events-none">
                    <div className="pointer-events-auto">
                        <SwarmOversightNode />
                    </div>
                </div>
            )}
        </div >
    );
};

export const HierarchyNode = React.memo(HierarchyNodeBase, (prev, next) => {
    // Optimization: Skip re-render if core visual state is identical
    const agentPrev = prev.agent;
    const agentNext = next.agent;

    if (!agentPrev || !agentNext) return false;

    return (
        agentPrev.status === agentNext.status &&
        agentPrev.currentTask === agentNext.currentTask &&
        agentPrev.costUsd === agentNext.costUsd &&
        agentPrev.tokensUsed === agentNext.tokensUsed &&
        agentPrev.model === agentNext.model &&
        agentPrev.model2 === agentNext.model2 &&
        agentPrev.model3 === agentNext.model3 &&
        agentPrev.activeModelSlot === agentNext.activeModelSlot &&
        agentPrev.role === agentNext.role &&
        prev.isActive === next.isActive &&
        prev.missionObjective === next.missionObjective &&
        prev.isAlpha === next.isAlpha
    );
});
