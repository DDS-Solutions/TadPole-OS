import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OpsDashboard from './OpsDashboard';
import { agents as mockAgents } from '../data/mockAgents';

// 1. Mock Hooks and Services
vi.mock('../hooks/useEngineStatus', () => ({
    useEngineStatus: vi.fn(() => ({
        isOnline: true,
        agentsCount: 10,
        connectionState: 'connected',
        uptime: 1000,
        cpu: 45,
        memory: 1024,
        latency: 50
    }))
}));

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
        connect: vi.fn()
    }
}));

vi.mock('../services/eventBus', () => ({
    EventBus: {
        getHistory: vi.fn(() => []),
        subscribe: vi.fn(() => () => { })
    }
}));

vi.mock('../services/workspaceStore', () => ({
    useWorkspaceStore: vi.fn(() => ({
        clusters: [
            { id: '1', isActive: true, collaborators: ['1', '2'] }
        ]
    }))
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// 2. Mock Child Components to reduce noise
vi.mock('../components/HierarchyNode', () => ({
    HierarchyNode: ({ agent, onRoleChange }: any) => (
        <div data-testid={`node-${agent.id}`}>
            {agent.name} - {agent.role}
            <button onClick={() => onRoleChange(agent.id, 'CEO')}>Promote</button>
        </div>
    )
}));

vi.mock('../components/Terminal', () => ({
    default: () => <div data-testid="terminal">Terminal</div>
}));

vi.mock('../components/AgentConfigPanel', () => ({
    default: () => <div data-testid="config-panel">Config Panel</div>
}));

describe('OpsDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders dashboard shell with metrics', async () => {
        render(<OpsDashboard />);

        // Check Status Cards
        expect(screen.getByText('Active Swarm')).toBeInTheDocument();
        expect(screen.getByText('System Health')).toBeInTheDocument();
        expect(screen.getByText('ONLINE')).toBeInTheDocument();
    });

    it('loads and displays agents from service', async () => {
        render(<OpsDashboard />);

        // Wait for loadAgents to resolve and populate state
        await waitFor(() => {
            expect(screen.getByTestId('node-1')).toBeInTheDocument(); // Agent of Nine
            expect(screen.getByTestId('node-2')).toBeInTheDocument(); // Tadpole
        });
    });

    it('handles role updates interaction', async () => {
        const { persistAgentUpdate } = await import('../services/agentService');
        render(<OpsDashboard />);

        await waitFor(() => screen.getByTestId('node-2'));

        // Click promote on Tadpole (Agent 2)
        fireEvent.click(screen.getByText('Promote', { selector: '[data-testid="node-2"] button' }));

        expect(persistAgentUpdate).toHaveBeenCalledWith('2', expect.objectContaining({ role: 'CEO' }));
    });
});
