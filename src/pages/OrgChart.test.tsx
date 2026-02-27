import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OrgChart from './OrgChart';
import { agents as mockAgents } from '../data/mockAgents';

// 1. Mock Hooks and Services
vi.mock('../services/agentService', () => ({
    loadAgents: vi.fn(async () => mockAgents),
    persistAgentUpdate: vi.fn()
}));

vi.mock('../services/openclawService', () => ({
    OpenClawService: {
        updateAgent: vi.fn()
    }
}));

vi.mock('../services/openclawSocket', () => ({
    openClawSocket: {
        subscribeAgentUpdates: vi.fn(() => () => { }),
        getConnectionState: vi.fn(() => 'connected'),
        connect: vi.fn(),
        subscribeStatus: vi.fn(() => () => { }),
        subscribeHealth: vi.fn(() => () => { })
    }
}));

vi.mock('../services/workspaceStore', () => ({
    useWorkspaceStore: vi.fn(() => ({
        clusters: [
            { id: '1', name: 'Alpha Cluster', theme: 'blue', alphaId: '1', collaborators: ['1'], isActive: true },
            { id: '2', name: 'Beta Cluster', theme: 'purple', alphaId: '2', collaborators: ['2', '3'], isActive: false },
            { id: '3', name: 'Gamma Cluster', theme: 'amber', alphaId: '3', collaborators: ['4', '5'], isActive: false }
        ]
    }))
}));

// 2. Mock Child Components
vi.mock('../components/HierarchyNode', () => ({
    HierarchyNode: ({ agent, isRoot, themeColor }: any) => (
        <div data-testid={`node-${agent.id}`} data-theme={themeColor}>
            {agent.name} - {isRoot ? 'ROOT' : 'NODE'}
        </div>
    )
}));

vi.mock('../components/AgentConfigPanel', () => ({
    default: () => <div data-testid="config-panel">Config Panel</div>
}));

describe('OrgChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders hierarchy shell', async () => {
        render(<OrgChart />);
        await waitFor(() => {
            expect(screen.getByText('NEURAL COMMAND HIERARCHY')).toBeInTheDocument();
            expect(screen.getByText(/ACTIVE AGENTS/)).toBeInTheDocument();
        });
    });

    it('partitions and displays agents correctly', async () => {
        render(<OrgChart />);

        await waitFor(() => {
            // Check Alpha (Root)
            const alphaNode = screen.getByTestId('node-1');
            expect(alphaNode).toBeInTheDocument();
            expect(alphaNode).toHaveTextContent('ROOT');

            // Check Nexus (Agent 2 or similar based on logic)
            // Logic: Alpha is 1. Nexus is 2.
            const nexusNode = screen.getByTestId('node-2');
            expect(nexusNode).toBeInTheDocument();

            // Check Chain Agents
            expect(screen.getByTestId('node-3')).toBeInTheDocument();
        });
    });

    it('displays cluster chains', async () => {
        render(<OrgChart />);

        await waitFor(() => {
            expect(screen.getByText('Chain 1')).toBeInTheDocument();
            expect(screen.getByText('Chain 2')).toBeInTheDocument();
            expect(screen.getByText('Chain 3')).toBeInTheDocument();
        });
    });
});
