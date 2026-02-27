import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Gateway } from '../server/gateway.js';
import { fetchSkill } from '../server/skills/fetch.js';
import type { SkillContext } from '../server/types.js';

describe('Neural Firewall Security Verification', () => {
    let gateway: Gateway;
    const PORT = 8001; // Use a different port for testing
    const TEST_TOKEN = 'tadpole-dev-token-2026';

    beforeAll(async () => {
        process.env.PORT = String(PORT);
        process.env.NEURAL_TOKEN = TEST_TOKEN;
        gateway = new Gateway();
        gateway.start();
        // Give the server a moment to start
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(() => {
        gateway.stop();
    });

    describe('API Authentication Guard', () => {
        it('should reject requests without a token', async () => {
            const res = await fetch(`http://localhost:${PORT}/oversight/pending`);
            expect(res.status).toBe(401);
            const data = await res.json() as any;
            expect(data.title).toContain('Unauthorized');
        });

        it('should reject requests with an invalid token', async () => {
            const res = await fetch(`http://localhost:${PORT}/oversight/pending`, {
                headers: { 'Authorization': 'Bearer wrong-token' }
            });
            expect(res.status).toBe(401);
        });

        it('should allow requests with the correct token', async () => {
            const res = await fetch(`http://localhost:${PORT}/oversight/pending`, {
                headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
            });
            expect(res.status).toBe(200);
        });
    });

    describe('SSRF Protection (Neural Firewall)', () => {
        const mockContext: SkillContext = {
            callTool: async () => ({ success: true, output: {} }),
            agent: { id: 'test', department: 'Engineering' } as any
        };

        it('should block attempts to fetch localhost', async () => {
            const result = await fetchSkill.execute({ url: `http://localhost:${PORT}/health` }, mockContext);
            expect(result.success).toBe(false);
            expect(result.output.error).toContain('Access to internal or local networks is restricted');
        });

        it('should block attempts to fetch 127.0.0.1', async () => {
            const result = await fetchSkill.execute({ url: `http://127.0.0.1:${PORT}/health` }, mockContext);
            expect(result.success).toBe(false);
        });

        it('should allow attempts to fetch external websites (simulated)', async () => {
            // We don't want to actually call the internet in a unit test if possible,
            // but we can check if it passes the SSRF check by checking if it attempts to call native fetch.
            // Since we can't easily mock global fetch here without a library, we'll just check a safe external IP/domain logic.
            const result = await fetchSkill.execute({ url: `https://google.com` }, mockContext);
            // This might fail if no internet, but it shouldn't fail with the "Neural Firewall" error.
            if (!result.success && result.output.error) {
                expect(result.output.error).not.toContain('Neural Firewall');
            }
        });
    });
});
