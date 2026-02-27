/**
 * @file tests/performance_optimization.test.ts
 * @description Verification suite for Phase 9: Performance & Scalability (Optimization).
 */

import { describe, it, expect } from 'vitest';
import { OversightGate } from '../server/oversight.js';
import { MemoryService } from '../server/memory.js';
import { randomUUID } from 'node:crypto';
import type { ToolCall } from '../server/types.js';

describe('Phase 9: Performance Optimization', () => {

    it('should maintain a bounded ledger in OversightGate', async () => {
        const oversight = new OversightGate(() => { });

        // Push 1100 actions
        for (let i = 0; i < 1100; i++) {
            const toolCall: ToolCall = {
                id: randomUUID(),
                agentId: 'test-agent',
                department: 'Engineering',
                skill: 'test',
                description: `Action ${i}`,
                params: {},
                timestamp: new Date().toISOString()
            };
            oversight.recordAction(toolCall, 'approved', { success: true });
        }

        const ledger = oversight.getLedger();
        expect(ledger.length).toBe(1000); // Should be capped at 1000
        expect(ledger[0].toolCall.description).toBe('Action 100'); // Oldest 100 should be gone
    });

    it('should cache SOUL.md content in MemoryService', async () => {
        const memory = new MemoryService();
        const workspace = './test-workspace';

        // Mocking fs isn't easy here without a full environment, 
        // but we can test the logic by calling it twice and checking speed or behavior.
        // For now, we'll verify the cache state exists.

        const soul1 = await memory.loadSoul(workspace);
        expect(soul1).toContain('Tadpole OS');

        // @ts-ignore - access private for testing
        expect(memory.soulCache.has(workspace)).toBe(true);
    });

    it('should expose throttle stats in Governor', async () => {
        // Governor is a singleton, but we can check its stats via Gateway pulse logic simulation
        const { globalGovernor } = await import('../server/governor.js');
        const stats = globalGovernor.getStats();
        expect(typeof stats).toBe('object');
    });
});
