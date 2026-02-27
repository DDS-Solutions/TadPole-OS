/**
 * @module server/providers/gemini
 * @description Google Gemini API adapter for the Tadpole Engine.
 * Handles model initialization, chat session management, and function calling parsing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ModelConfig, ModelProvider, Message, ToolDefinition } from '../types.js';

/**
 * Adapter class for interacting with Google's Gemini models.
 */
export class GeminiProvider implements ModelProvider {
    private genAI: GoogleGenerativeAI;
    private model: any;

    /**
     * Creates a new instance of the GeminiProvider.
     * @param apiKey Google API Key.
     * @param config Model configuration (modelId, temperature, systemPrompt).
     */
    constructor(apiKey: string, config: ModelConfig) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.modelId,
            systemInstruction: config.systemPrompt,
            generationConfig: {
                temperature: config.temperature,
            },
        });
    }

    /**
     * Generates a response from the model.
     * 
     * @param history The conversation history.
     * @param message The next user message or tool result to send.
     * @param tools Optional list of tool definitions to enable function calling.
     * @returns Object containing response text and/or a tool call.
     */
    async generate(history: Message[], message: string, tools?: ToolDefinition[]): Promise<{
        text?: string;
        toolCall?: { skill: string; params: any };
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    }> {
        const mappedHistory = history.map(h => {
            if (h.role === 'assistant') {
                const parts: any[] = [];
                if (h.content) parts.push({ text: h.content });
                if (h.tool_calls) {
                    h.tool_calls.forEach((tc) => {
                        parts.push({
                            functionCall: {
                                name: tc.function.name,
                                args: JSON.parse(tc.function.arguments)
                            }
                        });
                    });
                }
                return { role: 'model', parts };
            }
            if (h.role === 'tool') {
                return {
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: history.find((prev) => prev.tool_calls?.find((tc) => tc.id === h.tool_call_id))?.tool_calls?.find((tc) => tc.id === h.tool_call_id)?.function.name || 'unknown_tool',
                            response: { result: h.content }
                        }
                    }]
                };
            }
            return {
                role: 'user',
                parts: [{ text: h.content || '' }]
            };
        });

        const contents = [
            ...mappedHistory,
            ...(message ? [{ role: 'user', parts: [{ text: message }] }] : [])
        ];

        const requestOptions: any = {};
        if (tools && tools.length > 0) {
            requestOptions.tools = [{
                functionDeclarations: tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }))
            }];
        }

        const result = await this.model.generateContent({
            contents,
            ...requestOptions
        });

        const response = result.response;
        const text = response.text();
        const usage = response.usageMetadata;

        const returnVal: {
            text?: string;
            toolCall?: { skill: string; params: any };
            usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
        } = { text };

        if (usage) {
            returnVal.usage = {
                inputTokens: usage.promptTokenCount,
                outputTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount
            };
        }

        const calls = response.functionCalls();
        if (calls && calls.length > 0) {
            const call = calls[0];
            returnVal.toolCall = {
                skill: call.name,
                params: call.args
            };
        }

        return returnVal;
    }
}
