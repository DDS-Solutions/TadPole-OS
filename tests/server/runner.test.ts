import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AgentRunner } from '../../server/runner.js';
import { OversightGate } from '../../server/oversight.js';
import type { EngineAgent, ModelProvider, Message } from '../../server/types.js';

// Mock Node modules
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue('You are a test agent.')
}));

vi.mock('../../server/skills/index.js', () => ({
    skillRegistry: {
        'test-skill': {
            execute: vi.fn().mockResolvedValue({ result: 'success' })
        }
    },
    getAvailableTools: vi.fn().mockReturnValue([])
}));

describe('AgentRunner', () => {
    let runner: AgentRunner;
    let oversight: OversightGate;
    let mockProvider: ModelProvider;
    let mockGenerate: Mock;

    const mockAgent: EngineAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Tester',
        department: 'QA',
        description: 'Test',
        status: 'idle',
        tokensUsed: 0,
        workspace: './test-workspace',
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 },
        model: {
            provider: 'google',
            modelId: 'gemini-pro',
            apiKey: 'test-key'
        },
        skills: []
    };

    beforeEach(() => {
        // Mock Oversight
        oversight = new OversightGate(vi.fn());
        vi.spyOn(oversight, 'submit').mockResolvedValue(true);
        vi.spyOn(oversight, 'recordAction');

        // Mock Provider
        mockGenerate = vi.fn();
        mockProvider = {
            generate: mockGenerate
        };

        // Inject Mock Provider via Factory
        runner = new AgentRunner(oversight, () => mockProvider);
    });

    it('should return text response immediately', async () => {
        mockGenerate.mockResolvedValue({ text: 'Hello world' });

        const response = await runner.run(mockAgent, 'Hi');
        expect(response).toEqual({
            success: true,
            output: 'Hello world'
        });
        expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('should execute tool call and loop back', async () => {
        // Turn 1: Tool Call
        mockGenerate.mockResolvedValueOnce({
            toolCall: {
                skill: 'test-skill',
                params: { foo: 'bar' }
            }
        });

        // Turn 2: Final Response
        mockGenerate.mockResolvedValueOnce({
            text: 'Task done'
        });

        const response = await runner.run(mockAgent, 'Do something');

        expect(response).toEqual({
            success: true,
            output: 'Task done'
        });
        expect(mockGenerate).toHaveBeenCalledTimes(2);
        expect(oversight.submit).toHaveBeenCalled();
        expect(oversight.recordAction).toHaveBeenCalledWith(expect.anything(), 'approved', expect.anything());
    });

    it('should handle provider errors gracefully', async () => {
        mockGenerate.mockRejectedValue(new Error('API Rate Limit'));

        // It handles the error gracefully and returns a message
        const response = await runner.run(mockAgent, 'Hi');
        expect(response).toEqual({
            success: false,
            error: {
                code: 'RUNTIME_ERROR',
                message: expect.stringMatching(/API Rate Limit/)
            }
        });
    });
});

// ─────────────────────────────────────────────────────────
//  pruneHistory + estimateTokens — tested via exposed prototype
// ─────────────────────────────────────────────────────────
describe('AgentRunner — pruneHistory', () => {
    let runner: any; // access private methods

    beforeEach(() => {
        const oversight = new OversightGate(vi.fn());
        runner = new AgentRunner(oversight, vi.fn());
    });

    it('should NOT prune when under budget', () => {
        const history: Message[] = [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'hi' },
        ];
        // tpm=10000 — total tokens ~5, well under 70% of 10000
        runner['pruneHistory'](history, { tpm: 10000 });
        expect(history).toHaveLength(2);
    });

    it('should skip pruning when config has no tpm', () => {
        const history: Message[] = [
            { role: 'user', content: 'hello' },
        ];
        runner['pruneHistory'](history, {});
        expect(history).toHaveLength(1);
    });

    it('should remove tool response pairs first when over limit', () => {
        // Build history that exceeds a tiny TPM
        const history: Message[] = [
            { role: 'user', content: 'start' },          // 0 — anchored
            { role: 'assistant', content: 'calling tool', tool_calls: [{ id: '1', type: 'function' as const, function: { name: 'test', arguments: '{}' } }] },  // 1
            { role: 'tool', content: 'tool result data here with extra text to inflate token count' },  // 2
            { role: 'assistant', content: 'final answer here with some length' },  // 3
        ];

        // TPM is very small so everything is over budget
        runner['pruneHistory'](history, { tpm: 5 });

        // Tool pair (indices 1,2) should be removed first, possibly index 3 too
        // Minimum: first and last are anchored, so at most 2 remain
        expect(history.length).toBeLessThanOrEqual(2);
        // First message is always kept
        expect(history[0].role).toBe('user');
    });

    it('should preserve first and last messages as anchors', () => {
        const history: Message[] = [
            { role: 'user', content: 'a'.repeat(100) },
            { role: 'assistant', content: 'b'.repeat(100) },
            { role: 'user', content: 'c'.repeat(100) },
            { role: 'assistant', content: 'd'.repeat(100) },
        ];

        runner['pruneHistory'](history, { tpm: 10 });

        // First and last should survive
        expect(history[0].content).toBe('a'.repeat(100));
        expect(history[history.length - 1].content).toBe('d'.repeat(100));
    });
});

describe('AgentRunner — estimateTokens', () => {
    let runner: any;

    beforeEach(() => {
        const oversight = new OversightGate(vi.fn());
        runner = new AgentRunner(oversight, vi.fn());
    });

    it('should estimate ~4 chars per token', () => {
        const tokens = runner['estimateMessageTokens']({ role: 'user', content: 'abcd' });
        expect(tokens).toBe(1); // 4 chars / 4 = 1
    });

    it('should round up partial tokens', () => {
        const tokens = runner['estimateMessageTokens']({ role: 'user', content: 'abcde' });
        expect(tokens).toBe(2); // 5 chars / 4 = 1.25, ceil = 2
    });

    it('should include tool_calls in estimate', () => {
        const tokens = runner['estimateMessageTokens']({
            role: 'assistant',
            content: '',
            tool_calls: [{ id: '1', type: 'function' as const, function: { name: 'test', arguments: '{"a":"b"}' } }]
        });
        expect(tokens).toBeGreaterThan(0);
    });

    it('should sum all messages in estimateTokens', () => {
        const history: Message[] = [
            { role: 'user', content: 'abcd' },      // 1 token
            { role: 'assistant', content: 'efgh' },  // 1 token
        ];
        const total = runner['estimateTokens'](history);
        expect(total).toBe(2);
    });

    it('should return 0 for empty history', () => {
        const total = runner['estimateTokens']([]);
        expect(total).toBe(0);
    });
});
