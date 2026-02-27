/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Gateway } from '../../server/gateway.js';
import express from 'express';
import { WebSocketServer } from 'ws';

// Mock dependencies
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

vi.mock('../../server/runner.js', () => ({
    AgentRunner: class {
        run = vi.fn();
        static abortAll = vi.fn();
    }
}));

vi.mock('../../server/oversight.js', () => ({
    OversightGate: class {
        submit = vi.fn();
        getPending = vi.fn().mockReturnValue([]);
        getLedger = vi.fn().mockReturnValue([]);
        kill = vi.fn();
        decide = vi.fn();
        setGovernance = vi.fn();
        getStats = vi.fn().mockReturnValue({ pending: 0, ledgerSize: 0 });
    }
}));

describe('Gateway', () => {
    let gateway: Gateway;
    let mockApp: any;

    const authHeaders = { authorization: 'Bearer tadpole-dev-token-2026' };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        gateway = new Gateway();
        mockApp = mockAppInstance;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    // Helper to find and call the last handler in an express route definition
    const findAndCallHandler = async (method: string, path: string, req: any, res: any) => {
        const calls = (mockApp as any)[method].mock.calls;
        const call = calls.find((c: any) => c[0] === path);
        if (!call) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);

        // The last argument is the route handler
        const handlers = call.slice(1);

        // Execute middlewares and then the main handler
        for (const handler of handlers) {
            let nextCalled = false;
            const next = () => { nextCalled = true };
            await handler(req, res, next);
            if (!nextCalled) break; // Middleware blocked or handler finished
        }
    };

    it('should initialize with expected components', () => {
        expect(gateway).toBeDefined();
        expect(express).toHaveBeenCalled();
        expect(WebSocketServer).toHaveBeenCalled();
    });

    it('should setup basic routes', () => {
        expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
        expect(mockApp.get).toHaveBeenCalledWith('/', expect.any(Function));
        expect(mockApp.get).toHaveBeenCalledWith('/agents', expect.any(Function));
    });

    it('should broadcast heartbeat events', () => {
        const broadcastSpy = vi.spyOn(gateway as any, 'broadcastRaw');
        vi.advanceTimersByTime(3100);
        expect(broadcastSpy).toHaveBeenCalled();
    });

    it('health check route should return status ok', async () => {
        const req = { headers: {} };
        const res = { json: vi.fn() };
        await findAndCallHandler('get', '/health', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
    });

    it('agents route should return agents list with specific agent details', async () => {
        const req = { headers: {} };
        const res = { json: vi.fn() };
        await findAndCallHandler('get', '/agents', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.any(Array));
        const agents = res.json.mock.calls[0][0];
        expect(agents.length).toBeGreaterThan(0);
        expect(agents[0]).toHaveProperty('id');
    });

    it('agent config route should update agent', async () => {
        const req = {
            params: { id: '1' },
            body: { name: 'Updated Agent' },
            headers: authHeaders
        };
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
        await findAndCallHandler('post', '/agents/:id/config', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'updated',
            agentId: '1'
        }));
    });

    it('agent config route should initialize new agent', async () => {
        const req = {
            params: { id: 'new-agent' },
            body: { name: 'Brand New' },
            headers: authHeaders
        };
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
        await findAndCallHandler('post', '/agents/:id/config', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'updated',
            agentId: 'new-agent'
        }));
    });

    it('agents route should return detailed list when agents exist', async () => {
        // First hit config to populate
        await findAndCallHandler('post', '/agents/:id/config', {
            params: { id: 'test-agent' },
            body: { name: 'Test' },
            headers: authHeaders
        }, { json: vi.fn(), status: vi.fn().mockReturnThis() });

        const req = { headers: {} };
        const res = { json: vi.fn() };
        await findAndCallHandler('get', '/agents', req, res);
        expect(res.json).toHaveBeenCalled();
        const agents = res.json.mock.calls[0][0];
        expect(agents.find((a: any) => a.id === 'test-agent')).toBeDefined();
    });

    it('message route should trigger runner', async () => {
        const req = {
            params: { id: '1' },
            body: { message: 'Hello', stream: false },
            headers: authHeaders
        };
        const res = {
            json: vi.fn(),
            status: vi.fn().mockReturnThis(),
            write: vi.fn(),
            end: vi.fn(),
            setHeader: vi.fn()
        };
        await findAndCallHandler('post', '/agents/:id/send', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
    });

    it('oversight decision route should notify oversight gate', async () => {
        const req = {
            params: { id: 'req1' },
            body: { decision: 'approved' },
            headers: authHeaders
        };
        const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
        await findAndCallHandler('post', '/oversight/:id/decide', req, res);
        expect(res.json).toHaveBeenCalled();
    });

    it('oversight ledger route should return data', async () => {
        const req = { headers: authHeaders };
        const res = { json: vi.fn() };
        await findAndCallHandler('get', '/oversight/ledger', req, res);
        expect(res.json).toHaveBeenCalled();
    });

    it('engine kill route should execute cleanup', async () => {
        const req = { headers: authHeaders };
        const res = { json: vi.fn() };
        await findAndCallHandler('post', '/engine/kill', req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'killed' }));
    });
});
