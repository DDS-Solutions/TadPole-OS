/**
 * @module server/gateway
 * @description The main server logic for the Tadpole Engine.
 * Sets up the Express API and WebSocket server for real-time communication.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import { AgentRunner } from './runner.js';
import { OversightGate } from './oversight.js';
import { globalGovernor } from './governor.js';
import { exec } from 'child_process';
import type { EngineAgent, EngineEvent, AgentStatus, AgentConfig, TaskPayload, LLMProvider, ProblemDetails } from './types.js';
import { skillRegistry } from './skills/index.js';
import { PROVIDERS } from './constants.js';

/**
 * Gateway class that orchestrates the REST API, WebSocket server, and Agent Runner.
 */
export class Gateway {
    private app = express();
    private server = createServer(this.app);
    private wss = new WebSocketServer({ server: this.server, path: '/events' });
    private port: number | string;

    // Core Components
    /** Central oversight gate for all tool executions. */
    private oversight: OversightGate;
    /** Main execution loop for agents. */
    private runner: AgentRunner;
    /** In-memory registry of active agents. */
    private agents: Map<string, EngineAgent> = new Map();

    /** Debounce timer for high-frequency telemetry. */
    private lastTelemetryTime: Map<string, number> = new Map();
    /** Cache of last broadcast health payload for diff-based broadcasting. */
    private lastHealthPayload: string = '';
    /** Event loop latency measurement anchor. */
    private lastLoopTime: number = Date.now();

    constructor(port?: number | string) {
        this.port = port || process.env.PORT || 8000;
        // Initialize Oversight 
        // Pass a broadcast callback so Oversight can notify frontend of new pending requests
        this.oversight = new OversightGate(this.broadcast.bind(this));

        // Initialize Runner with Oversight dependency
        this.runner = new AgentRunner(this.oversight);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSockets();
        this.startHeartbeat();

        console.log(`🔐 Neural Gate Initialized.`);
        console.log(`   - Auth Token: ${process.env.NEURAL_TOKEN ? '(From .env)' : '(Default: tadpole-dev-token-2026)'}`);
        if (!process.env.NEURAL_TOKEN) {
            console.log(`   ⚠️  No .env found. Using default token: "tadpole-dev-token-2026"`);
        }
    }

    /**
     * Starts a periodic heartbeat to broadcast engine health (Neural Pulse).
     * Interval: 3000ms — diff-based to skip identical payloads.
     * Latency is measured via event loop lag, not hardcoded.
     */
    private startHeartbeat() {
        setInterval(() => {
            // Measure real event loop latency
            const now = Date.now();
            const expectedInterval = 3000;
            const loopLag = Math.max(0, (now - this.lastLoopTime) - expectedInterval);
            this.lastLoopTime = now;

            const stats = this.oversight.getStats();
            const healthEvent: Record<string, unknown> = {
                type: 'engine:health',
                uptime: process.uptime(),
                agents: this.agents.size,
                latencyMs: loopLag,
                throttleStats: globalGovernor.getStats(),
                ...stats
            };

            // Diff-based: skip broadcast if payload is identical
            const payload = JSON.stringify(healthEvent);
            if (payload !== this.lastHealthPayload) {
                this.lastHealthPayload = payload;
                this.broadcastRaw(payload);
            }
        }, 3000);
    }

    /**
     * Configures Express middleware (CORS, JSON parsing).
     */
    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    /**
     * Defines REST API routes.
     */
    private setupRoutes() {
        // Health Check
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok', uptime: process.uptime() });
        });

        // Root Route (Welcome)
        this.app.get('/', (_req, res) => {
            res.send('🐸 Tadpole Engine API is running. Go to http://localhost:5173 for the Dashboard.');
        });

        // --- Neural Authentication Middleware ---
        const authRequired = (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
            const expectedToken = process.env.NEURAL_TOKEN || 'tadpole-dev-token-2026';

            if (token !== expectedToken) {
                console.warn(`🔒 Unauthorized access attempt: ${req.method} ${req.path}`);
                this.sendProblem(res, {
                    type: 'https://tadpole.ai/probs/unauthorized',
                    title: 'Unauthorized Access',
                    status: 401,
                    detail: 'Missing or invalid Neural Token.'
                });
                return;
            }
            next();
        };

        // --- Agent Routes ---

        /**
         * GET /agents
         * Returns list of available agents. (Public for Dashboard)
         */
        this.app.get('/agents', (_req, res) => {
            // Return live agents from memory if available, otherwise return defaults
            if (this.agents.size > 0) {
                res.json(Array.from(this.agents.values()).map(a => ({
                    id: a.id,
                    name: a.name,
                    status: a.status,
                    metadata: {
                        role: a.role,
                        department: a.department
                    },
                    model: a.model,
                    skills: a.skills
                })));
            } else {
                // Default System Alpha
                res.json([{
                    id: '1',
                    name: 'Agent of Nine',
                    status: 'idle',
                    metadata: {
                        role: 'CEO',
                        department: 'Executive'
                    }
                }]);
            }
        });

        /**
         * POST /agents/:id/config
         * Updates or initializes an agent's metadata without executing a task.
         * PROTECTED: Requires Neural Token.
         */
        this.app.post('/agents/:id/config', authRequired, (req, res) => {
            const agentId = String(req.params.id);
            const updates = req.body as AgentConfig;

            let agent = this.agents.get(agentId);
            if (!agent) {
                agent = {
                    id: agentId,
                    name: updates.name || 'New Agent',
                    role: updates.role || 'AI Agent',
                    department: updates.department || 'Operations',
                    description: updates.description || 'A newly initialized intelligence.',
                    model: {
                        provider: (updates.provider as LLMProvider) || PROVIDERS.GOOGLE,
                        modelId: updates.modelId || 'gemini-1.5-pro',
                        apiKey: updates.apiKey || (updates.provider === PROVIDERS.GOOGLE || !updates.provider ? process.env.GOOGLE_API_KEY : undefined)
                    },
                    status: 'idle' as const,
                    skills: [],
                    workspace: `./workspaces/${agentId}`,
                    tokensUsed: 0,
                    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 }
                };
                this.agents.set(agentId, agent!);
            }

            // Apply updates
            if (updates.name) agent!.name = updates.name;
            if (updates.role) agent!.role = updates.role;
            if (updates.department) agent!.department = updates.department;
            if (updates.provider) agent!.model.provider = updates.provider as LLMProvider;
            if (updates.modelId) agent!.model.modelId = updates.modelId;
            if (updates.apiKey) agent!.model.apiKey = updates.apiKey;
            if (updates.baseUrl) agent!.model.baseUrl = updates.baseUrl;
            if (updates.systemPrompt) agent!.model.systemPrompt = updates.systemPrompt;
            if (updates.temperature !== undefined) agent!.model.temperature = updates.temperature;
            if (updates.skills) {
                agent!.skills = updates.skills.map(s => ({ skill: s, enabled: true }));
            }

            if (!updates.silent) {
                console.log(`👤 Updated Agent Config: ${agent!.name} (${agentId})`);
            }
            res.json({ status: 'updated', agentId: agent!.id });
        });

        /**
         * POST /agents/:id/pause
         * Pauses an active agent.
         */
        this.app.post('/agents/:id/pause', authRequired, (req, res) => {
            const agentId = String(req.params.id);
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.status = 'paused';
                this.broadcast({ type: 'agent:status', agentId, status: 'paused' });
                console.log(`⏸️ Agent ${agentId} paused by user.`);
                res.json({ status: 'paused', agentId });
            } else {
                res.status(404).json({ error: 'Agent not found' });
            }
        });

        /**
         * POST /agents/:id/resume
         * Resumes a paused agent.
         */
        this.app.post('/agents/:id/resume', authRequired, (req, res) => {
            const agentId = String(req.params.id);
            const agent = this.agents.get(agentId);
            if (agent) {
                const newStatus = 'active';
                agent.status = newStatus;
                this.broadcast({ type: 'agent:status', agentId, status: newStatus });
                console.log(`▶️ Agent ${agentId} resumed by user.`);
                res.json({ status: newStatus, agentId });
            } else {
                res.status(404).json({ error: 'Agent not found' });
            }
        });

        /**
         * POST /agents/:id/send
         * Sends a message to an agent. This triggers the Agent Runner loop.
         */
        this.app.post('/agents/:id/send', async (req, res) => {
            const { message, clusterId, provider, modelId, apiKey, baseUrl, rpm, tpm, rpd, tpd, ...updates } = req.body as TaskPayload & AgentConfig;
            const agentId = String(req.params.id);

            console.log(`📡 [Gateway] Received SendCommand for Agent ${agentId}`);

            const agent = this.getOrInitializeAgent(agentId, provider, updates);
            this.agents.set(agentId, agent);

            if (modelId) agent!.model.modelId = modelId;
            if (provider) agent!.model.provider = provider as LLMProvider;
            if (apiKey) agent!.model.apiKey = apiKey;
            if (baseUrl) agent!.model.baseUrl = baseUrl;
            if (rpm) agent!.model.rpm = rpm;
            if (tpm) agent!.model.tpm = tpm;
            if (rpd) agent!.model.rpd = rpd;
            if (tpd) agent!.model.tpd = tpd;

            res.json({ status: 'accepted', agentId: agent!.id });

            try {
                this.broadcast({ type: 'agent:status', agentId: agent!.id, status: 'active' });

                const result = await this.runner.run(agent!, message, clusterId, (update) => {
                    let statusToBroadcast: AgentStatus | undefined;

                    if (update.currentTask) {
                        const task = update.currentTask;
                        if (task.includes('Thinking')) statusToBroadcast = 'thinking';
                        if (task.includes('Executing')) statusToBroadcast = 'active';
                        if (task.includes('Oversight')) statusToBroadcast = 'thinking';
                        if (task.includes('Writing Code') || task.includes('Coding')) statusToBroadcast = 'coding';
                    }

                    if (update.tokenUsage) {
                        const { inputTokens, outputTokens, totalTokens } = update.tokenUsage;
                        agent!.tokenUsage.inputTokens += inputTokens;
                        agent!.tokenUsage.outputTokens += outputTokens;
                        agent!.tokenUsage.totalTokens += totalTokens;
                        agent!.tokensUsed = agent!.tokenUsage.totalTokens;
                    }

                    this.broadcast({
                        type: 'agent:update',
                        agentId: agent!.id,
                        data: {
                            ...update,
                            tokensUsed: agent!.tokenUsage.totalTokens,
                            status: statusToBroadcast || agent!.status
                        }
                    });

                    if (statusToBroadcast && !this.oversight.isKilled()) {
                        agent!.status = statusToBroadcast;
                    }
                });

                if (result.success && result.output) {
                    this.broadcast({ type: 'agent:message', agentId: agent!.id, text: result.output });
                } else if (!result.success && result.error) {
                    this.broadcast({ type: 'agent:message', agentId: agent!.id, text: `❌ ${result.error.message}` });
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.broadcast({ type: 'agent:message', agentId: agent!.id, text: `Error: ${errorMessage}` });
            } finally {
                this.broadcast({ type: 'agent:status', agentId: agent!.id, status: 'idle' });
            }
        });

        // --- Oversight Routes (ALL PROTECTED) ---
        this.app.get('/oversight/pending', authRequired, (_req, res) => {
            res.json(this.oversight.getPending());
        });

        this.app.get('/oversight/ledger', authRequired, (_req, res) => {
            res.json(this.oversight.getLedger());
        });

        this.app.post('/oversight/:id/decide', authRequired, (req, res) => {
            const { decision } = req.body;
            if (decision !== 'approved' && decision !== 'rejected') {
                res.status(400).json({ error: 'Invalid decision' });
                return;
            }

            const entry = this.oversight.decide(String(req.params.id), decision);
            if (!entry) {
                res.status(404).json({ error: 'Oversight entry not found' });
                return;
            }

            res.json(entry);
        });

        this.app.post('/engine/kill', authRequired, (_req, res) => {
            this.oversight.kill('Emergency Kill Switch activated by user.');
            AgentRunner.abortAll();
            for (const agent of this.agents.values()) {
                agent.status = 'idle';
                this.broadcast({ type: 'agent:status', agentId: agent.id, status: 'idle' });
            }
            res.json({ status: 'killed', message: 'Engine halted. All agents set to idle.' });
        });

        this.app.post('/engine/shutdown', authRequired, (_req, res) => {
            res.json({ status: 'shutdown', message: 'Server shutting down now...' });
            setTimeout(() => process.exit(0), 500);
        });

        this.app.post('/engine/deploy', authRequired, (_req, res) => {
            exec('powershell.exe -ExecutionPolicy Bypass -File deploy.ps1', (error, stdout, stderr) => {
                if (error) {
                    res.status(500).json({ error: error.message, stderr });
                    return;
                }
                res.json({ status: 'success', output: stdout });
            });
        });

        this.app.post('/oversight/settings', authRequired, (req, res) => {
            const settings = req.body;
            this.oversight.setGovernance(settings);
            res.json({ status: 'updated' });
        });

        this.app.get('/openapi.json', (_req, res) => {
            const tools = Object.values(skillRegistry).map(skill => ({
                name: skill.name,
                description: skill.description,
                intent_tags: skill.intent_tags,
                parameters: skill.schema
            }));

            res.json({
                openapi: '3.1.0',
                info: {
                    title: 'Tadpole OS Engine',
                    version: '1.0.0',
                    description: 'A multi-agent operating system engine with industrial AX.'
                },
                paths: {
                    '/agents': {
                        get: {
                            summary: 'List all agents',
                            responses: {
                                '200': { description: 'Success' }
                            }
                        }
                    }
                },
                components: {
                    schemas: {
                        ProblemDetails: {
                            type: 'object',
                            properties: {
                                type: { type: 'string' },
                                title: { type: 'string' },
                                status: { type: 'integer' },
                                detail: { type: 'string' },
                                instance: { type: 'string' }
                            }
                        }
                    }
                },
                'x-tadpole-skills': tools
            });
        });
    }

    private sendProblem(res: express.Response, problem: ProblemDetails) {
        res.status(problem.status).contentType('application/problem+json').json(problem);
    }

    private setupWebSockets() {
        this.wss.on('connection', (ws) => {
            console.log('🔌 Dashboard connected');
            ws.on('close', () => console.log('🔌 Dashboard disconnected'));
        });
    }

    private broadcast(event: EngineEvent) {
        // Debounce high-frequency telemetry (100ms per agent)
        if (event.type === 'agent:telemetry') {
            const now = Date.now();
            const lastTime = this.lastTelemetryTime.get(event.agentId) || 0;
            if (now - lastTime < 100) return;
            this.lastTelemetryTime.set(event.agentId, now);
        }

        this.broadcastRaw(JSON.stringify(event));
    }

    /** Low-level broadcast: sends a pre-serialized payload to all connected clients. */
    private broadcastRaw(payload: string) {
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(payload);
            }
        });
    }

    private getOrInitializeAgent(agentId: string, provider?: string, updates?: AgentConfig): EngineAgent {
        const agent = this.agents.get(agentId);
        if (agent) return agent;

        let name = 'New Agent';
        let role = 'AI Agent';
        let description = 'A newly initialized intelligence.';

        if (agentId === '1') {
            name = 'Agent of Nine';
            role = 'CEO';
            description = 'Strategic lead.';
        }

        return {
            id: agentId,
            name: updates?.name || name,
            role: updates?.role || role,
            department: updates?.department || 'Operations',
            description: updates?.description || description,
            model: {
                provider: (provider as LLMProvider) || PROVIDERS.GOOGLE,
                modelId: 'gemini-1.5-pro',
                apiKey: (provider === PROVIDERS.GOOGLE || !provider) ? process.env.GOOGLE_API_KEY : undefined
            },
            status: 'idle' as const,
            skills: [],
            workspace: `./workspaces/${agentId}`,
            tokensUsed: 0,
            tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 }
        };
    }

    public start() {
        this.server.listen(this.port as number, '0.0.0.0', () => {
            console.log(`Tadpole Engine started on port ${this.port}`);
        });
    }

    public stop() {
        this.server.close();
        this.wss.close();
    }
}
