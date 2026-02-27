/**
 * @module server/providers/groq
 * @description Groq API provider implementation for the Tadpole Engine.
 */

import Groq from 'groq-sdk';
import type { ModelConfig, ModelProvider, Message, ToolDefinition } from '../types.js';

export class GroqProvider implements ModelProvider {
    private client: Groq;
    private config: ModelConfig;

    constructor(apiKey: string, config: ModelConfig) {
        this.client = new Groq({
            apiKey: apiKey
        });
        this.config = config;
    }

    async generate(
        history: Message[],
        message: string,
        tools?: ToolDefinition[]
    ): Promise<{
        text?: string;
        toolCall?: { skill: string; params: any };
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    }> {
        // Convert history to Groq format
        const messages: any[] = [
            { role: 'system', content: this.config.systemPrompt || 'You are a helpful AI assistant.' },
            ...history.map(msg => {
                if (msg.role === 'tool') {
                    return {
                        role: 'tool',
                        tool_call_id: msg.tool_call_id,
                        content: msg.content
                    };
                }
                const mapped: any = {
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content || (msg.tool_calls ? null : "")
                };
                if (msg.tool_calls) {
                    mapped.tool_calls = msg.tool_calls;
                }
                return mapped;
            }),
            ...(message ? [{ role: 'user', content: message }] : [])
        ];

        // Map tools to Groq tool format
        let groqTools;
        if (tools && tools.length > 0) {
            groqTools = tools.map(tool => ({
                type: 'function' as const,
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            }));
        }

        try {
            return await this.executeRequest(messages, groqTools);
        } catch (error: any) {
            // --- Phase 13: Syntax Recovery (V3) ---
            if (error.message.includes('tool_use_failed') || error.message.includes('Failed to call a function')) {
                console.warn(`⚠️  Groq: Tool syntax error detected. Attempting one-time recovery retry...`);

                // Add a corrective message to the flow
                const recoveryHistory = [
                    ...messages,
                    {
                        role: 'user',
                        content: 'CRITICAL SYNTAX ERROR: Your previous tool call was malformed (e.g., missing a closing bracket or comma). Please re-generate the tool call now with perfect JSON syntax.'
                    }
                ];

                return await this.executeRequest(recoveryHistory, groqTools);
            }

            console.error('Groq API Error:', error);
            throw new Error(`Groq API Error: ${error.message}`);
        }
    }

    /**
     * Internal helper to execute the Groq completion request.
     */
    private async executeRequest(messages: any[], groqTools?: any) {
        const completion = await this.client.chat.completions.create({
            messages: messages,
            model: this.config.modelId || 'llama-3.3-70b-versatile',
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 4096,
            tools: groqTools,
            tool_choice: groqTools ? 'auto' : 'none'
        });

        const choice = completion.choices[0];
        const usage = completion.usage;

        const response: {
            text?: string;
            toolCall?: { skill: string; params: any };
            usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
        } = {
            usage: usage ? {
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
            } : undefined
        };

        // Handle Tool Calls
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            const toolCall = choice.message.tool_calls[0];
            try {
                response.toolCall = {
                    skill: toolCall.function.name,
                    params: JSON.parse(toolCall.function.arguments)
                };
            } catch (e) {
                // If parsing fails, we treat it as an error to trigger the retry logic
                throw new Error(`Failed to call a function: JSON Parse Error`);
            }

            if (choice.message.content) {
                response.text = choice.message.content;
            }
        } else {
            response.text = choice.message.content || '';
        }

        return response;
    }
}
