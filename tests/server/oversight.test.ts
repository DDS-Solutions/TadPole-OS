import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { OversightGate } from '../../server/oversight.js';
import type { ToolCall } from '../../server/types.js';

describe('OversightGate', () => {
    let oversight: OversightGate;
    let broadcastMock: Mock;

    beforeEach(() => {
        broadcastMock = vi.fn();
        oversight = new OversightGate(broadcastMock);
    });

    it('should queue a submission and notify listeners', async () => {
        const toolCall: ToolCall = {
            id: '123',
            agentId: 'agent-1',
            department: 'Engineering',
            skill: 'test-skill',
            description: 'test',
            params: {},
            timestamp: new Date().toISOString()
        };

        const submitPromise = oversight.submit(toolCall);

        expect(oversight.getPending().length).toBe(1);
        expect(broadcastMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'oversight:new'
        }));

        const pendingId = oversight.getPending()[0].id; // Get the generated ID
        oversight.decide(pendingId, 'approved');

        const approved = await submitPromise;
        expect(approved).toBe(true);
    });

    it('should handle rejection', async () => {
        const toolCall: ToolCall = {
            id: '124',
            agentId: 'agent-1',
            department: 'Engineering',
            skill: 'test-skill',
            description: 'test',
            params: {},
            timestamp: new Date().toISOString()
        };

        const submitPromise = oversight.submit(toolCall);

        const pendingId = oversight.getPending()[0].id;
        oversight.decide(pendingId, 'rejected');

        const approved = await submitPromise;
        expect(approved).toBe(false);
    });

    it('should reject all when kill switch is active', async () => {
        oversight.kill('Emergency');
        expect(oversight.isKilled()).toBe(true);

        const toolCall: ToolCall = {
            id: '999',
            agentId: 'a',
            department: 'Engineering',
            skill: 's',
            description: 'd',
            params: {},
            timestamp: new Date().toISOString()
        };

        const result = oversight.submit(toolCall);

        // Kill switch rejects immediately (sync check, async return)
        await expect(result).resolves.toBe(false);
    });
});
