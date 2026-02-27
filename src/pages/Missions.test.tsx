import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Missions from './Missions';
import * as AgentService from '../services/agentService';

// Mock dependencies
vi.mock('../services/agentService', () => ({
    loadAgents: vi.fn(),
}));

vi.mock('../services/workspaceStore', () => {
    const mockStore = () => ({
        clusters: [
            {
                id: 'c-001',
                name: 'Alpha Cluster',
                department: 'Engineering',
                theme: 'blue',
                path: '/workspaces/alpha',
                collaborators: ['1', '2'],
                isActive: true,
                pendingTasks: [],
                activeProposals: {},
            }
        ],
        createCluster: vi.fn(),
        assignAgentToCluster: vi.fn(),
        unassignAgentFromCluster: vi.fn(),
        updateClusterObjective: vi.fn(),
    });

    (mockStore as any).getState = () => ({
        activeProposals: {},
        dismissProposal: vi.fn(),
        applyProposal: vi.fn(),
    });

    return { useWorkspaceStore: mockStore };
});

vi.mock('../services/openclawSocket', () => ({
    openClawSocket: {
        subscribeHandoff: vi.fn(() => () => { }),
    }
}));

describe('Missions Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (AgentService.loadAgents as any).mockResolvedValue([
            { id: '1', name: 'Agent 1', role: 'Dev' },
            { id: '2', name: 'Agent 2', role: 'Tester' }
        ]);
    });

    it('renders the mission management header', async () => {
        render(<Missions />);
        expect(screen.getByText('MISSION MANAGEMENT')).toBeInTheDocument();
        expect(screen.getByText(/ACTIVE CLUSTERS/i)).toBeInTheDocument();
    });

    it('displays the new cluster modal when clicking New Mission', async () => {
        render(<Missions />);

        const newButton = screen.getByText('NEW MISSION');
        fireEvent.click(newButton);

        expect(screen.getByText('Define New Cluster')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Mission Name...')).toBeInTheDocument();
    });

    it('includes Marketing and Design in the department dropdown', async () => {
        render(<Missions />);

        fireEvent.click(screen.getByText('NEW MISSION'));

        const select = screen.getAllByRole('combobox')[0];
        expect(select).toBeInTheDocument();

        expect(screen.getAllByRole('option', { name: 'Marketing' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('option', { name: 'Design' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('option', { name: 'Research' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('option', { name: 'Support' })[0]).toBeInTheDocument();
    });
});
