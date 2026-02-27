/**
 * @module server/runner
 * @description Core agent runtime loop.
 * Orchestrates the cycle of: Memory -> Prompt -> Model -> Oversight -> Tool -> Memory.
 */

import { GeminiProvider } from './providers/gemini.js';
import { GroqProvider } from './providers/groq.js';
import { OpenAIProvider } from './providers/openai.js';
import { MemoryService } from './memory.js';
import type { EngineAgent, ToolCall, ModelProvider, ModelConfig, Message, ToolDefinition, RunnerResult, ToolResult } from './types.js';
import { globalGovernor } from './governor.js';
import { OversightGate } from './oversight.js';
import { skillRegistry, getAvailableTools } from './skills/index.js';
import { randomUUID } from 'node:crypto';
import { PROVIDERS } from './constants.js';
import { PromptBuilder } from './promptBuilder.js';

/**
 * Manages the execution context and lifecycle of a single agent task.
 */
export class AgentRunner {
    private memory = new MemoryService();
    private oversight: OversightGate;
    public static isAborting = false;

    /** Factory function to create a provider instance from configuration. */
    private providerFactory: (agent: EngineAgent, systemPrompt: string) => ModelProvider;

    constructor(
        oversight: OversightGate,
        providerFactory?: (agent: EngineAgent, systemPrompt: string) => ModelProvider
    ) {
        this.oversight = oversight;
        // Default to Gemini if no factory provided (Production mode)
        this.providerFactory = providerFactory || ((agent, systemPrompt) => {
            if (agent.model.provider === PROVIDERS.GOOGLE) {
                return new GeminiProvider(agent.model.apiKey || '', {
                    ...agent.model,
                    systemPrompt
                });
            }
            if (agent.model.provider === PROVIDERS.GROQ) {
                return new GroqProvider(agent.model.apiKey || '', {
                    ...agent.model,
                    systemPrompt
                });
            }
            if (agent.model.provider === PROVIDERS.OPENAI) {
                return new OpenAIProvider(agent.model.apiKey || '', {
                    ...agent.model,
                    systemPrompt
                });
            }
            throw new Error(`Provider '${agent.model.provider}' not supported.`);
        });
    }

    /**
     * Globally aborts all running agents.
     */
    public static abortAll() {
        this.isAborting = true;
        console.log("🛑 Global Abort Signal Sent to all Agent Runners.");

        // Reset only after a long delay (e.g. 10 seconds), or require manual reset.
        // For now, we extend it significantly to catch long-running agents.
        setTimeout(() => {
            this.isAborting = false;
            console.log("🟢 Global Abort Signal Reset.");
        }, 10000);
    }

    /**
     * Executes a task for an agent.
     * This method runs until the task is complete, an error occurs, or the turn limit is reached.
     * 
     * @param agent The agent configuration.
     * @param userMessage The user's input message/task.
     * @returns The final text response from the agent.
     */
    async run(
        agent: EngineAgent,
        userMessage: string,
        clusterId?: string,
        onUpdate?: (data: Partial<EngineAgent>) => void
    ): Promise<RunnerResult> {
        // ... Load Soul ...
        let soul = await this.memory.loadSoul(agent.workspace);
        const systemPrompt = PromptBuilder.build(agent, soul, clusterId);

        // 2. Validate Configuration
        if (!agent.model.apiKey && !process.env.TEST_MODE) {
            return {
                success: false,
                error: {
                    code: 'CONFIG_ERROR',
                    message: `No API key configured for model '${agent.model.modelId}' on provider '${agent.model.provider}'. Please check Settings.`
                }
            };
        }

        const history: Message[] = [];
        const maxTurns = 12;
        let currentTurn = 0;

        // Initialize token usage tracking
        let sessionUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 };

        try {
            // Instantiate provider using the factory (DI)
            const provider = this.providerFactory(agent, systemPrompt);

            // SECURITY: Filter tools by department
            const tools = getAvailableTools(agent.department) as ToolDefinition[];
            let nextMessage = userMessage;

            // --- Execution Loop ---
            while (currentTurn < maxTurns) {
                // Check Global Abort OR Oversight Kill Switch
                if (AgentRunner.isAborting || this.oversight.isKilled()) {
                    console.log(`🛑 Aborting Agent ${agent.id} turn ${currentTurn} `);
                    return {
                        success: false,
                        error: {
                            code: 'ABORTED',
                            message: "Emergency Stop: Agent execution halted by Kill Switch."
                        }
                    };
                }

                currentTurn++;
                console.log(`🔄 Turn ${currentTurn}: Generating...`);

                if (onUpdate) {
                    onUpdate({ currentTask: "🧠 Thinking..." });
                }

                // --- Governor Check (TPM/RPM) ---
                await globalGovernor.throttle(agent.model);

                // --- Neural Pruning: Prevent context overflow ---
                this.pruneHistory(history, agent.model);

                // Call provider. History is passed by reference and updated inside the loop
                const result = await provider.generate(history, nextMessage, tools);

                // --- Abort Check after Generation ---
                if (AgentRunner.isAborting || this.oversight.isKilled()) {
                    return { success: false, error: { code: 'ABORTED', message: "Agent execution halted by Kill Switch." } };
                }

                // Record Usage for Governor
                if (result.usage) {
                    globalGovernor.recordUsage(agent.model.modelId, result.usage);
                }

                // Update Usage
                if (result.usage) {
                    sessionUsage.inputTokens += result.usage.inputTokens;
                    sessionUsage.outputTokens += result.usage.outputTokens;
                    sessionUsage.totalTokens += result.usage.totalTokens;

                    const inputCost = result.usage.inputTokens * 0.00000035;
                    const outputCost = result.usage.outputTokens * 0.00000105;
                    sessionUsage.totalCost += (inputCost + outputCost);

                    if (onUpdate) {
                        onUpdate({
                            tokensUsed: sessionUsage.totalTokens,
                            tokenUsage: sessionUsage
                        });
                    }
                }

                // CASE 1: Text Response (Task Complete or Question)
                if (result.text && !result.toolCall) {
                    if (onUpdate) onUpdate({ currentTask: "" });

                    // --- Telemetry: Transition to Finalizing ---
                    this.oversight.emit({
                        type: 'agent:telemetry',
                        agentId: agent.id,
                        phase: 'finalizing',
                        timestamp: new Date().toISOString(),
                        details: 'text_response'
                    });

                    return {
                        success: true,
                        output: result.text
                    };
                }

                // CASE 2: Tool Call
                if (result.toolCall) {
                    const call = result.toolCall;

                    // --- Telemetry: Transition to Executing ---
                    if (onUpdate) onUpdate({ currentTask: `🛠️ Executing ${call.skill}...` });
                    this.oversight.emit({
                        type: 'agent:telemetry',
                        agentId: agent.id,
                        phase: 'executing',
                        timestamp: new Date().toISOString(),
                        details: call.skill
                    });

                    // Define recursive tool executor for SkillContext
                    const executeToolRecursive = async (name: string, params: any): Promise<ToolResult> => {
                        const toolCallId = `call_${randomUUID().slice(0, 8)} `;
                        const toolCallObj: ToolCall = {
                            id: toolCallId,
                            agentId: agent.id,
                            department: agent.department,
                            clusterId: clusterId,
                            skill: name,
                            description: `Call: ${name} `,
                            params: params,
                            timestamp: new Date().toISOString()
                        };

                        if (onUpdate) {
                            onUpdate({ currentTask: `🛡️ Oversight: ${name}...` });
                        }

                        // Submit to Oversight Gate
                        const approved = await this.oversight.submit(toolCallObj);

                        if (!approved) {
                            this.oversight.recordAction(toolCallObj, 'rejected');
                            throw new Error(`Action '${name}' was rejected by Oversight.`);
                        }

                        const skillImpl = skillRegistry[name];
                        if (!skillImpl) {
                            throw new Error(`Skill '${name}' not found.`);
                        }

                        if (onUpdate) {
                            onUpdate({ currentTask: `⚙️ Executing: ${name}...` });
                        }

                        const startTime = Date.now();
                        const output = await skillImpl.execute(params, { callTool: executeToolRecursive, agent });
                        const durationMs = Date.now() - startTime;

                        // Record Result in Ledger
                        this.oversight.recordAction(toolCallObj, 'approved', {
                            success: output.success,
                            output: output.output,
                            durationMs
                        });

                        return output;
                    };

                    try {
                        const topLevelToolCallId = `call_${randomUUID().slice(0, 8)} `;
                        const toolCallObj: ToolCall = {
                            id: topLevelToolCallId,
                            agentId: agent.id,
                            department: agent.department,
                            clusterId: clusterId,
                            skill: call.skill,
                            description: `Top-level: ${call.skill} `,
                            params: call.params,
                            timestamp: new Date().toISOString()
                        };

                        if (onUpdate) {
                            onUpdate({ currentTask: `🛡️ Oversight: ${call.skill}...` });
                        }

                        // Top-level oversight check
                        const approved = await this.oversight.submit(toolCallObj);

                        if (!approved) {
                            this.oversight.recordAction(toolCallObj, 'rejected');
                            if (onUpdate) onUpdate({ currentTask: "" });
                            return {
                                success: false,
                                error: {
                                    code: 'OVERSIGHT_REJECTION',
                                    message: "Agent action rejected by user."
                                }
                            };
                        }

                        const skill = skillRegistry[call.skill];
                        if (!skill) {
                            throw new Error(`Skill '${call.skill}' not found.`);
                        }

                        if (onUpdate) {
                            onUpdate({ currentTask: `⚙️ Executing: ${call.skill}...` });
                        }

                        // --- Abort Check before Tool Execution ---
                        if (AgentRunner.isAborting || this.oversight.isKilled()) {
                            throw new Error("Agent execution halted by Kill Switch.");
                        }

                        const startTime = Date.now();
                        const output = await skill.execute(call.params, { callTool: executeToolRecursive, agent });
                        const duration = Date.now() - startTime;

                        // Record Result
                        this.oversight.recordAction(toolCallObj, 'approved', {
                            success: output.success,
                            output: output.output,
                            durationMs: duration
                        });

                        // Structured history updates
                        if (currentTurn === 1) {
                            history.push({ role: 'user', content: nextMessage });
                        }

                        history.push({
                            role: 'assistant',
                            content: result.text || undefined,
                            tool_calls: [
                                {
                                    id: topLevelToolCallId,
                                    type: 'function',
                                    function: {
                                        name: call.skill,
                                        arguments: JSON.stringify(call.params)
                                    }
                                }
                            ]
                        });

                        history.push({
                            role: 'tool',
                            tool_call_id: topLevelToolCallId,
                            name: call.skill,
                            content: JSON.stringify(output)
                        });

                        nextMessage = "";
                    } catch (error: any) {
                        console.error(`Tool execution failed: ${error.message} `);
                        history.push({
                            role: 'tool',
                            tool_call_id: randomUUID(),
                            name: call.skill,
                            content: JSON.stringify({ success: false, output: { error: error.message } })
                        });
                        nextMessage = "";
                    }
                }
            }

            if (onUpdate) onUpdate({ currentTask: "" });
            return {
                success: false,
                error: {
                    code: 'RUNTIME_ERROR',
                    message: "Agent loop limit reached."
                }
            };

        } catch (error: any) {
            console.error("Runner Error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('429') || errorMessage.includes('413')) {
                let retryAfter = 60;
                if (error.headers && error.headers['retry-after']) {
                    retryAfter = parseInt(error.headers['retry-after'], 10) || 60;
                }
                globalGovernor.recordBackoff(agent.model.modelId, retryAfter);
                return {
                    success: false,
                    error: {
                        code: 'RATE_LIMIT',
                        message: `Neural Engine saturated (Rate Limit). Automatic backoff engaged for ${retryAfter}s.`
                    }
                };
            }
            return {
                success: false,
                error: {
                    code: 'RUNTIME_ERROR',
                    message: `Agent Error: ${errorMessage} `
                }
            };
        }
    }

    /**
     * Estimates the token count for a single message (used for incremental tracking).
     * Uses the ~4 chars/token heuristic.
     */
    private estimateMessageTokens(msg: Message): number {
        const toolPart = msg.tool_calls ? JSON.stringify(msg.tool_calls) : '';
        return Math.ceil(((msg.content || '').length + toolPart.length) / 4);
    }

    /**
     * Estimates the total token count for the full history.
     * Only used for initial calculation; pruning tracks deltas incrementally.
     */
    private estimateTokens(history: Message[]): number {
        return history.reduce((acc, msg) => acc + this.estimateMessageTokens(msg), 0);
    }

    /**
     * Prunes conversation history to stay within TPM safety limits.
     * Uses incremental token tracking to avoid O(n²) full re-serialization.
     * Prioritizes removing tool result pairs (assistant+tool) before general messages.
     */
    private pruneHistory(history: Message[], config: Pick<ModelConfig, 'tpm'>) {
        if (!config.tpm) return;

        const limit = config.tpm;
        const safetyThreshold = 0.7;
        const target = limit * safetyThreshold;

        // Single pass: calculate current total
        let currentTokens = this.estimateTokens(history);
        if (currentTokens <= target) return;

        // Mark-and-sweep: identify indices to remove, then filter once
        const toRemove = new Set<number>();

        // Phase 1: Remove tool result pairs (assistant + tool response)
        for (let i = 0; i < history.length && currentTokens > target; i++) {
            if (history[i].role === 'tool' && !toRemove.has(i)) {
                // Remove the tool response
                currentTokens -= this.estimateMessageTokens(history[i]);
                toRemove.add(i);

                // Also remove the preceding assistant message if it's a tool-call trigger
                if (i > 0 && history[i - 1].role === 'assistant' && !toRemove.has(i - 1)) {
                    currentTokens -= this.estimateMessageTokens(history[i - 1]);
                    toRemove.add(i - 1);
                }
            }
        }

        // Phase 2: If still over limit, remove non-anchored messages (skip first and last)
        for (let i = 1; i < history.length - 1 && currentTokens > target; i++) {
            if (!toRemove.has(i)) {
                currentTokens -= this.estimateMessageTokens(history[i]);
                toRemove.add(i);
            }
        }

        // Single filter pass instead of repeated splice operations
        if (toRemove.size > 0) {
            const pruned = history.filter((_, idx) => !toRemove.has(idx));
            history.length = 0;
            history.push(...pruned);
        }
    }
}
