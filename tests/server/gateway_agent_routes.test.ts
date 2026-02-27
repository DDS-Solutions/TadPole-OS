/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Gateway } from '../../server/gateway.js';
import express from 'express';
import { WebSocketServer } from 'ws';

// --- Mocks Setup (Copied from gateway.test.ts to ensure consistency) ---
const mockAppInstance = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    options: vi.fn(),
    listen: vi.fn()
};

vi.mock('express', () => {
    const expressMock = vi.fn(() => mockAppInstance);
    (expressMock as any).json = vi.fn(() => (req: any, res: any, next: any) => next());
    (expressMock as any).urlencoded = vi.fn(() => (req: any, res: any, next: any) => next());
    (expressMock as any).Router = vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        use: vi.fn()
    }));
    return {
        default: expressMock,
        json: (expressMock as any).json,
        urlencoded: (expressMock as any).urlencoded
    };
});

vi.mock('cors', () => ({
    default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('http', () => {
    const mockServer = {
        listen: vi.fn(),
        close: vi.fn(),
        on: vi.fn()
    };
    return {
        createServer: vi.fn().mockReturnValue(mockServer),
        default: {
            createServer: vi.fn().mockReturnValue(mockServer)
        }
    };
});

const mockWSSInstance = {
    on: vi.fn(),
    clients: new Set(),
    close: vi.fn()
};

vi.mock('ws', () => {
    return {
        WebSocketServer: vi.fn().mockImplementation(function () {
            return mockWSSInstance;
        })
    };
});

vi.mock('../../server/runner', () => ({
    AgentRunner: class {
        run = vi.fn();
        static abortAll = vi.fn();
    }
}));

vi.mock('../../server/oversight', () => ({
    OversightGate: class {
        submit = vi.fn();
        getPending = vi.fn().mockReturnValue([]);
        getLedger = vi.fn().mockReturnValue([]);
        kill = vi.fn();
        decide = vi.fn();
        setGovernance = vi.fn();
        isKilled = vi.fn().mockReturnValue(false);
    }
}));

// --- Tests ---

describe('Gateway Agent Pause/Resume Routes', () => {
    let gateway: Gateway;
    let mockApp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        gateway = new Gateway();
        mockApp = mockAppInstance;

        // Mock Auth Middleware bypass (since we are testing the handler logic)
        process.env.NEURAL_TOKEN = 'test-token';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.NEURAL_TOKEN;
    });

    describe('POST /agents/:id/pause', () => {
        it('should pause an active agent', () => {
            const agentId = 'test-agent-pause';

            // Seed agent
            gateway['agents'].set(agentId, {
                id: agentId,
                name: 'Test Agent',
                role: 'Tester',
                department: 'QA',
                description: 'Desc',
                model: { provider: 'google', modelId: 'gemini-1.5-pro' },
                status: 'active',
                skills: [],
                workspace: './',
                tokensUsed: 0,
                tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 }
            });

            const req = { params: { id: agentId } };
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

            // [0]=path, [1]=middleware, [2]=handler
            const call = mockApp.post.mock.calls.find((call: any) => call[0] === '/agents/:id/pause');
            // If middleware is missing, handler is at index 1. If present, index 2.
            // Based on debug runs, we suspect index 2.
            // Safely grab the function that is NOT the middleware (which might be named 'authRequired' or likely anonymous if bound)
            // But let's stick to index 2 as per gateway.ts structure.
            const handler = call ? call[2] : undefined;

            if (!handler) {
                throw new Error('Handler not found for /agents/:id/pause. Calls: ' + JSON.stringify(mockApp.post.mock.calls.map((c: any) => c[0])));
            }

            handler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'paused',
                agentId: agentId
            }));

            const agent = gateway['agents'].get(agentId);
            expect(agent?.status).toBe('paused');
        });

        it('should return 404 if agent not found', () => {
            const req = { params: { id: 'missing-agent' } };
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

            const call = mockApp.post.mock.calls.find((call: any) => call[0] === '/agents/:id/pause');
            const handler = call ? call[2] : undefined;

            handler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Agent not found' });
        });
    });

    describe('POST /agents/:id/resume', () => {
        it('should resume a paused agent', () => {
            const agentId = 'test-agent-resume';

            // Seed agent
            gateway['agents'].set(agentId, {
                id: agentId,
                name: 'Test Agent',
                role: 'Tester',
                department: 'QA',
                description: 'Desc',
                model: { provider: 'google', modelId: 'gemini-1.5-pro' },
                status: 'paused',
                skills: [],
                workspace: './',
                tokensUsed: 0,
                tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 }
            });

            const req = { params: { id: agentId } };
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

            const call = mockApp.post.mock.calls.find((call: any) => call[0] === '/agents/:id/resume');
            const handler = call ? call[2] : undefined;

            handler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'active',
                agentId: agentId
            }));

            const agent = gateway['agents'].get(agentId);
            expect(agent?.status).toBe('active');
        });

        it('should return 404 if agent not found', () => {
            const req = { params: { id: 'missing-agent' } };
            const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

            const call = mockApp.post.mock.calls.find((call: any) => call[0] === '/agents/:id/resume');
            const handler = call ? call[2] : undefined;

            handler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Agent not found' });
        });
    });
});
