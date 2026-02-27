/**
 * @module workspaceStore
 * Managed state for collaborative Mission Clusters and Task Branching.
 * 
 * DESIGN PATTERN: Mission-Based Clusters
 * - Replaces individual agent silos with shared paths based on active missions.
 * - Implements a "Task Branch" workflow where changes can be reviewed/approved by Alpha nodes.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MissionCluster {
    id: string;
    name: string;
    department: 'Executive' | 'Engineering' | 'Product' | 'Sales' | 'Operations' | 'Quality Assurance' | 'Design' | 'Research' | 'Support' | 'Marketing';
    path: string;
    collaborators: string[]; // Agent IDs
    alphaId?: string; // The leader of the cluster
    objective?: string; // High-level mission objective
    theme: 'cyan' | 'purple' | 'amber' | 'blue';
    pendingTasks: TaskBranch[];
    isActive?: boolean;
    budgetUsd?: number;
}

export interface SwarmProposal {
    clusterId: string;
    reasoning: string;
    changes: {
        agentId: string;
        proposedRole?: string;
        proposedModel?: string;
        addedSkills?: string[];
        addedWorkflows?: string[];
    }[];
    timestamp: number;
}

export interface TaskBranch {
    id: string;
    agentId: string;
    description: string;
    targetPath: string;
    status: 'pending' | 'merging' | 'completed' | 'rejected';
    timestamp: number;
}

interface WorkspaceState {
    clusters: MissionCluster[];
    activeProposals: Record<string, SwarmProposal>; // clusterId -> proposal

    // Actions
    createCluster: (mission: Omit<MissionCluster, 'id' | 'pendingTasks'>) => void;
    assignAgentToCluster: (agentId: string, clusterId: string) => void;
    unassignAgentFromCluster: (agentId: string, clusterId: string) => void;
    updateClusterObjective: (clusterId: string, objective: string) => void;
    updateClusterDepartment: (clusterId: string, department: MissionCluster['department']) => void;
    updateClusterBudget: (clusterId: string, budget: number) => void;
    generateProposal: (clusterId: string) => void;
    applyProposal: (clusterId: string) => void;
    dismissProposal: (clusterId: string) => void;
    setAlphaNode: (clusterId: string, agentId: string) => void;
    deleteCluster: (clusterId: string) => void;
    toggleClusterActive: (clusterId: string) => void;
    addBranch: (clusterId: string, branch: Omit<TaskBranch, 'id' | 'status' | 'timestamp'>) => void;
    approveBranch: (clusterId: string, branchId: string) => void;
    rejectBranch: (clusterId: string, branchId: string) => void;
    receiveHandoff: (sourceClusterId: string, targetClusterId: string, description: string) => void;

    // Internal path calculation
    getAgentPath: (agentId: string) => string;
}

const DEFAULT_CLUSTERS: MissionCluster[] = [
    {
        id: 'cl-chain-a',
        name: 'Strategic Ops (Chain A)',
        department: 'Operations',
        path: '/workspaces/strategic-ops',
        collaborators: ['3', '4', '5', '6'],
        alphaId: '3',
        objective: 'Optimize swarm coordination and strategic resource allocation.',
        theme: 'cyan',
        pendingTasks: [],
        isActive: false
    },
    {
        id: 'cl-chain-b',
        name: 'Core Intelligence (Chain B)',
        department: 'Engineering',
        path: '/workspaces/core-intelligence',
        collaborators: ['7', '8', '9', '10'],
        alphaId: '7',
        objective: 'Enhance neural processing efficiency and knowledge synthesis.',
        theme: 'purple',
        pendingTasks: []
    },
    {
        id: 'cl-chain-c',
        name: 'Applied Growth (Chain C)',
        department: 'Product',
        path: '/workspaces/applied-growth',
        collaborators: ['11', '12', '13', '14'],
        alphaId: '11',
        objective: 'Iterate on user-facing features and scale operational impact.',
        theme: 'amber',
        pendingTasks: []
    }
];

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            clusters: DEFAULT_CLUSTERS,
            activeProposals: {},

            createCluster: (mission) => set(state => ({
                clusters: [...state.clusters, { ...mission, id: `cl-${crypto.randomUUID().split('-')[0]}`, pendingTasks: [] }]
            })),

            assignAgentToCluster: (agentId, clusterId) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? { ...c, collaborators: [...new Set([...c.collaborators, agentId])] } : c
                )
            })),

            unassignAgentFromCluster: (agentId, clusterId) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? {
                        ...c,
                        collaborators: c.collaborators.filter(id => id !== agentId),
                        alphaId: c.alphaId === agentId ? undefined : c.alphaId
                    } : c
                )
            })),

            updateClusterObjective: (clusterId, objective) => {
                set(state => ({
                    clusters: state.clusters.map(c =>
                        c.id === clusterId ? { ...c, objective } : c
                    )
                }));
                // Trigger auto-proposal
                get().generateProposal(clusterId);
            },

            updateClusterDepartment: (clusterId, department) => {
                set(state => ({
                    clusters: state.clusters.map(c =>
                        c.id === clusterId ? { ...c, department } : c
                    )
                }));
            },

            updateClusterBudget: (clusterId, budget) => {
                set(state => ({
                    clusters: state.clusters.map(c =>
                        c.id === clusterId ? { ...c, budgetUsd: budget } : c
                    )
                }));
            },

            generateProposal: (clusterId) => {
                const cluster = get().clusters.find(c => c.id === clusterId);
                if (!cluster || !cluster.objective) return;

                // SIMULATION LOGIC: Parse objective for keywords to suggest reconfigs
                const obj = cluster.objective.toLowerCase();
                let reasoning = `Alpha Node analysis of mission objective: "${cluster.objective}"`;
                const changes: SwarmProposal['changes'] = [];

                if (obj.includes('security') || obj.includes('patch') || obj.includes('vulnerability')) {
                    reasoning += "\n- DEEP THREAT DETECTED: Elevating security protocols and switching to precision models.";
                    cluster.collaborators.forEach(id => {
                        changes.push({
                            agentId: id,
                            proposedRole: 'Security Hardener',
                            proposedModel: 'DeepSeek V3.2',
                            addedSkills: ['Scan Vulnerabilities', 'Code Audit']
                        });
                    });
                } else if (obj.includes('scale') || obj.includes('perf') || obj.includes('optimize')) {
                    reasoning += "\n- PERFORMANCE BOTTLENECK: Shifting to high-efficiency models and DevOps automation.";
                    cluster.collaborators.forEach(id => {
                        changes.push({
                            agentId: id,
                            proposedRole: 'Performance Architect',
                            proposedModel: 'Claude Sonnet 4.5',
                            addedSkills: ['Check Server Health', 'View Logs']
                        });
                    });
                } else if (obj.includes('growth') || obj.includes('user') || obj.includes('feature')) {
                    reasoning += "\n- USER-CENTRIC EXPANSION: Allocating creative models for feature synthesis.";
                    cluster.collaborators.forEach(id => {
                        changes.push({
                            agentId: id,
                            proposedRole: 'Growth Catalyst',
                            proposedModel: 'GPT-5.2',
                            addedSkills: ['Market Research', 'UX Audit']
                        });
                    });
                } else {
                    reasoning += "\n- STANDARD OPS: Aligning team with baseline swarm efficiency.";
                    cluster.collaborators.forEach(id => {
                        changes.push({
                            agentId: id,
                            addedSkills: ['Deep Research']
                        });
                    });
                }

                set(state => ({
                    activeProposals: {
                        ...state.activeProposals,
                        [clusterId]: {
                            clusterId,
                            reasoning,
                            changes,
                            timestamp: Date.now()
                        }
                    }
                }));
            },

            applyProposal: (clusterId) => {
                const proposal = get().activeProposals[clusterId];
                if (!proposal) return;

                // In a real app, this would update the global agent list in agentStore.
                // For the prototype, we assume these are mission-specific overrides
                // handled by the UI when the mission is active.

                // We clear the proposal once applied
                set(state => {
                    const nextProposals = { ...state.activeProposals };
                    delete nextProposals[clusterId];
                    return { activeProposals: nextProposals };
                });
            },

            dismissProposal: (clusterId) => set(state => {
                const nextProposals = { ...state.activeProposals };
                delete nextProposals[clusterId];
                return { activeProposals: nextProposals };
            }),

            setAlphaNode: (clusterId, agentId) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? { ...c, alphaId: agentId } : c
                )
            })),

            deleteCluster: (clusterId: string) => set(state => ({
                clusters: state.clusters.filter(c => c.id !== clusterId)
            })),

            toggleClusterActive: (clusterId: string) => set(state => ({
                clusters: state.clusters.map(c => ({
                    ...c,
                    isActive: c.id === clusterId ? !c.isActive : false
                }))
            })),

            addBranch: (clusterId, branch) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? {
                        ...c,
                        pendingTasks: [...c.pendingTasks, {
                            ...branch,
                            id: `br-${Date.now()}`,
                            status: 'pending',
                            timestamp: Date.now()
                        }]
                    } : c
                )
            })),

            approveBranch: (clusterId, branchId) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? {
                        ...c,
                        pendingTasks: c.pendingTasks.map(t => t.id === branchId ? { ...t, status: 'completed' } : t)
                    } : c
                )
            })),

            rejectBranch: (clusterId, branchId) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === clusterId ? {
                        ...c,
                        pendingTasks: c.pendingTasks.map(t => t.id === branchId ? { ...t, status: 'rejected' } : t)
                    } : c
                )
            })),

            receiveHandoff: (sourceClusterId, targetClusterId, description) => set(state => ({
                clusters: state.clusters.map(c =>
                    c.id === targetClusterId ? {
                        ...c,
                        pendingTasks: [...c.pendingTasks, {
                            id: `ho-${Date.now()}`,
                            agentId: 'System (Handoff)',
                            description: `[HANDOFF FROM ${sourceClusterId}] ${description}`,
                            targetPath: c.path,
                            status: 'pending',
                            timestamp: Date.now()
                        }]
                    } : c
                )
            })),

            getAgentPath: (agentId) => {
                const cluster = get().clusters.find(c => c.collaborators.includes(agentId));
                return cluster ? cluster.path : `/workspaces/agent-silo-${agentId}`;
            }
        }),
        {
            name: 'tadpole-workspaces-v3'
        }
    )
);
