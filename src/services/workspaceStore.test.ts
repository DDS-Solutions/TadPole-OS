import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to ensure localStorage is mocked BEFORE workspaceStore is imported
vi.hoisted(() => {
    const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        clear: vi.fn(),
        removeItem: vi.fn(),
        length: 0,
        key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
});

import { useWorkspaceStore } from './workspaceStore';

describe('workspaceStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a new cluster', () => {
        const { createCluster } = useWorkspaceStore.getState();

        createCluster({
            name: 'New Test Mission',
            department: 'Engineering',
            path: '/workspaces/test',
            collaborators: ['test-agent'],
            theme: 'blue',
            objective: 'Test creating a cluster'
        });

        const { clusters } = useWorkspaceStore.getState();
        const newCluster = clusters.find(c => c.name === 'New Test Mission');

        expect(newCluster).toBeDefined();
        expect(newCluster?.collaborators).toContain('test-agent');
    });

    it('assigns and unassigns agents from clusters', () => {
        const { clusters, assignAgentToCluster, unassignAgentFromCluster } = useWorkspaceStore.getState();
        const clusterId = clusters[0].id;

        assignAgentToCluster('agent-99', clusterId);
        expect(useWorkspaceStore.getState().clusters.find(c => c.id === clusterId)?.collaborators).toContain('agent-99');

        unassignAgentFromCluster('agent-99', clusterId);
        expect(useWorkspaceStore.getState().clusters.find(c => c.id === clusterId)?.collaborators).not.toContain('agent-99');
    });

    it('generates proposals based on mission objectives', () => {
        const { clusters, updateClusterObjective } = useWorkspaceStore.getState();
        const clusterId = clusters[0].id;

        updateClusterObjective(clusterId, 'We need to fix several security vulnerabilities in the core engine.');

        const { activeProposals } = useWorkspaceStore.getState();
        const proposal = activeProposals[clusterId];

        expect(proposal).toBeDefined();
        expect(proposal.reasoning).toContain('DEEP THREAT DETECTED');
    });

    it('handles task branching (add, approve, reject)', () => {
        const { clusters, addBranch, approveBranch, rejectBranch } = useWorkspaceStore.getState();
        const clusterId = clusters[0].id;

        addBranch(clusterId, {
            agentId: 'agent-1',
            description: 'Refactor auth logic',
            targetPath: '/src/auth'
        });

        let cluster = useWorkspaceStore.getState().clusters.find(c => c.id === clusterId);
        const branchId = cluster?.pendingTasks[0].id!;
        expect(cluster?.pendingTasks[0].status).toBe('pending');

        approveBranch(clusterId, branchId);
        cluster = useWorkspaceStore.getState().clusters.find(c => c.id === clusterId);
        expect(cluster?.pendingTasks.find(t => t.id === branchId)?.status).toBe('completed');

        addBranch(clusterId, {
            agentId: 'agent-2',
            description: 'Experiment with rust',
            targetPath: '/src/experimental'
        });

        cluster = useWorkspaceStore.getState().clusters.find(c => c.id === clusterId);
        const secondBranchId = cluster?.pendingTasks.find(t => t.description === 'Experiment with rust')?.id!;

        rejectBranch(clusterId, secondBranchId);
        cluster = useWorkspaceStore.getState().clusters.find(c => c.id === clusterId);
        expect(cluster?.pendingTasks.find(t => t.id === secondBranchId)?.status).toBe('rejected');
    });
});
