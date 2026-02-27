/**
 * @module server/providers/openai
 * @description Generic OpenAI-compatible provider implementation.
 * Supports official OpenAI API as well as custom base URLs (Ollama, LocalAI, etc.).
 */

import type { ModelConfig, ModelProvider, Message, ToolDefinition } from '../types.js';

export class OpenAIProvider implements ModelProvider {
    private apiKey: string;
    private config: ModelConfig;

    constructor(apiKey: string, config: ModelConfig) {
        this.apiKey = apiKey;
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
        const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

        // Convert history to OpenAI format
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
                    content: msg.content || ""
                };
                if (msg.tool_calls) {
                    mapped.tool_calls = msg.tool_calls;
                }
                return mapped;
            }),
            ...(message ? [{ role: 'user', content: message }] : [])
        ];

        // Map tools to OpenAI tool format
        let openAiTools;
        if (tools && tools.length > 0) {
            openAiTools = tools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }
            }));
        }

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.modelId,
                    messages: messages,
                    temperature: this.config.temperature || 0.7,
                    tools: openAiTools,
                    tool_choice: openAiTools ? 'auto' : undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API Error (${response.status}): ${JSON.stringify(errorData)}`);
            }

            const completion = await response.json() as any;
            const choice = completion.choices[0];
            const usage = completion.usage;

            const result: {
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
                result.toolCall = {
                    skill: toolCall.function.name,
                    params: JSON.parse(toolCall.function.arguments)
                };
                if (choice.message.content) {
                    result.text = choice.message.content;
                }
            } else {
                result.text = choice.message.content || '';
            }

            return result;

        } catch (error: any) {
            console.error('OpenAI Provider Error:', error);
            throw new Error(`OpenAI Provider Error: ${error.message}`);
        }
    }
}
