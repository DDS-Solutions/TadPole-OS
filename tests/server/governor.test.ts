import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Governor } from '../../server/governor.js';

describe('Governor', () => {
    let gov: Governor;

    beforeEach(() => {
        gov = new Governor();
    });

    describe('throttle — basic flow', () => {
        it('should pass through when no limits are set', async () => {
            await gov.throttle({ modelId: 'test', provider: 'test' } as any);
            // No error thrown = pass
        });

        it('should record usage correctly', () => {
            // Must throttle first to create the bucket
            gov.throttle({ modelId: 'test', provider: 'test' } as any);
            gov.recordUsage('test', { totalTokens: 500 });
            // No error = pass
        });
    });

    describe('recordBackoff', () => {
        it('should set a penalty that expires', async () => {
            gov.recordBackoff('slow-model', 0.01); // 10ms penalty

            const stats = gov.getStats();
            expect(stats['slow-model:penalty']).toBeGreaterThan(0);

            // After penalty expires
            await new Promise(r => setTimeout(r, 20));
            const statsAfter = gov.getStats();
            expect(statsAfter['slow-model:penalty']).toBeUndefined();
        });
    });

    describe('getStats', () => {
        it('should return empty stats initially', () => {
            const stats = gov.getStats();
            expect(Object.keys(stats)).toHaveLength(0);
        });

        it('should include penalty durations for penalized models', () => {
            gov.recordBackoff('penalized-model', 60);
            const stats = gov.getStats();
            expect(stats['penalized-model:penalty']).toBeGreaterThan(0);
        });
    });

    describe('throttle — RPM enforcement', () => {
        it('should track requests in the bucket', async () => {
            const config = { modelId: 'fast-model', provider: 'test', rpm: 100 } as any;
            await gov.throttle(config);
            await gov.throttle(config);
            await gov.throttle(config);
            // 3 requests, well under 100 RPM
            const stats = gov.getStats();
            expect(stats['fast-model']).toBeDefined();
        });
    });

    describe('throttle — daily limits', () => {
        it('should reject when daily request limit exceeded', async () => {
            const config = { modelId: 'limited-model', provider: 'test', rpd: 2 } as any;
            await gov.throttle(config);
            await gov.throttle(config);

            await expect(gov.throttle(config)).rejects.toThrow('Daily Request Limit');
        });

        it('should reject when daily token limit exceeded', async () => {
            const config = { modelId: 'token-limited', provider: 'test', tpd: 100 } as any;
            await gov.throttle(config);
            gov.recordUsage('token-limited', { totalTokens: 150 });

            await expect(gov.throttle(config)).rejects.toThrow('Daily Token Limit');
        });
    });
});
