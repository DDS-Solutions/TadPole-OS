import { describe, it, expect, vi, beforeEach, type Mock, type Mocked } from 'vitest';
import { OversightGate } from '../../server/oversight.js';
import { AgentRunner } from '../../server/runner.js';
import type { ToolCall, EngineAgent } from '../../server/types.js';

// Mock OversightGate to avoid complex partial mocks
vi.mock('../../server/oversight');

describe('Phase 30: System Intelligence Verification', () => {
    let oversight: Mocked<OversightGate>;
    let broadcastMock: Mock;
    // runner is instantiated inside tests or beforeEach but not used in scope


    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup Broadcast Mock
        broadcastMock = vi.fn();

        // Setup Oversight Mock
        // We cast to Mocked<OversightGate> because vi.mock hoists the auto-mock
        oversight = new OversightGate(broadcastMock) as Mocked<OversightGate>;

        // Define default behaviors for the mock
        oversight.submit = vi.fn().mockResolvedValue(true);
        oversight.getPending = vi.fn().mockReturnValue([]);

        // Inject mock provider factory for runner tests (instantiation only)
        new AgentRunner(oversight, () => ({
            generate: vi.fn()
        }));
    });

    describe('Mission-Aware Oversight', () => {
        it('should propagate clusterId from runner to oversight', async () => {
            const agent: EngineAgent = {
                id: 'test-agent',
                name: 'Test',
                role: 'Tester',
                department: 'QA',
                description: 'Test',
                status: 'idle',
                workspace: './',
                tokensUsed: 0,
                tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 },
                model: { provider: 'google', modelId: 'gemini-pro', apiKey: 'test' },
                skills: []
            };

            const mockGenerate = vi.fn();

            // Sequence: 1. Tool Call, 2. Text Response (Stop)
            mockGenerate
                .mockResolvedValueOnce({
                    toolCall: { skill: 'test-skill', params: {} }
                })
                .mockResolvedValueOnce({ text: 'Done' });

            const localRunner = new AgentRunner(oversight, () => ({ generate: mockGenerate }));

            // Trigger run with a clusterId
            const clusterId = 'mission-alpha-9';
            await localRunner.run(agent, 'Start', clusterId);

            expect(oversight.submit).toHaveBeenCalledWith(expect.objectContaining({
                clusterId: clusterId
            }));
        });
    });

    describe('Safe Skills Auto-Approval', () => {
        it('should auto-approve "weather" skill', async () => {
            const toolCall: ToolCall = {
                id: 'tc-weather',
                agentId: 'agent-1',
                department: 'Research',
                skill: 'weather',
                description: 'Checking weather',
                params: { location: 'London' },
                timestamp: new Date().toISOString()
            };

            // Test logic implies we are testing the REAL oversight logic here,
            // but we mocked the class. 
            // IF we want to test the logic, we should restore original implementation OR test logic in isolation.
            // For now, let's assuming we want to verify proper class interaction or 
            // if we need to test logic, we should UNMOCK for this suite.
            //
            // Correct approach for UNIT testing the Oversight Logic:
            // Instantiate a REAL OversightGate with a mocked broadcaster.

            const realOversight = new (await vi.importActual<typeof import('../../server/oversight.js')>('../../server/oversight.js')).OversightGate(broadcastMock);

            const approved = await realOversight.submit(toolCall);
            expect(approved).toBe(true);
            expect(realOversight.getPending().length).toBe(0);
        });

        it('should auto-approve "reasoning" skill', async () => {
            const realOversight = new (await vi.importActual<typeof import('../../server/oversight.js')>('../../server/oversight.js')).OversightGate(broadcastMock);

            const toolCall: ToolCall = {
                id: 'tc-reasoning',
                agentId: 'agent-1',
                department: 'Engineering',
                skill: 'reasoning',
                description: 'Thinking...',
                params: { step: 'Hypothesis' },
                timestamp: new Date().toISOString()
            };

            const approved = await realOversight.submit(toolCall);
            expect(approved).toBe(true);
            expect(realOversight.getPending().length).toBe(0);
        });

        it('should NOT auto-approve unknown skills', async () => {
            const realOversight = new (await vi.importActual<typeof import('../../server/oversight.js')>('../../server/oversight.js')).OversightGate(broadcastMock);

            const toolCall: ToolCall = {
                id: 'tc-unsafe',
                agentId: 'agent-1',
                department: 'Marketing',
                skill: 'shell_execute',
                description: 'Dangerous action',
                params: { cmd: 'rm -rf /' },
                timestamp: new Date().toISOString()
            };

            const submitPromise = realOversight.submit(toolCall);

            // Allow event loop tick
            await new Promise(r => setTimeout(r, 0));

            expect(realOversight.getPending().length).toBe(1);

            const pendingId = realOversight.getPending()[0].id;
            realOversight.decide(pendingId, 'rejected');

            expect(await submitPromise).toBe(false);
        });
    });
});
