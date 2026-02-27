import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqProvider } from '../../../server/providers/groq.js';
import type { ModelConfig } from '../../../server/types.js';
import Groq from 'groq-sdk';

// Mock Groq SDK
const { mockCreate } = vi.hoisted(() => ({
    mockCreate: vi.fn()
}));

vi.mock('groq-sdk', () => {
    return {
        default: vi.fn(function () {
            return {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };
        })
    };
});

describe('GroqProvider', () => {
    let provider: GroqProvider;
    const mockConfig: ModelConfig = {
        modelId: 'llama3-70b-8192',
        provider: 'groq',
        temperature: 0.5,
        systemPrompt: 'System instructions'
    };
    const mockApiKey = 'test-api-key';

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new GroqProvider(mockApiKey, mockConfig);
    });

    it('should initialize successfully', () => {
        expect(Groq).toHaveBeenCalledWith({ apiKey: mockApiKey });
        expect(provider).toBeDefined();
    });

    it('should generate text response', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: { content: 'Groq Response' }
            }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30
            }
        });

        const result = await provider.generate([], 'Hello');

        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            messages: expect.arrayContaining([
                expect.objectContaining({ role: 'user', content: 'Hello' })
            ]),
            model: 'llama3-70b-8192'
        }));

        expect(result.text).toBe('Groq Response');
        expect(result.usage).toEqual({
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30
        });
    });

    it('should handle tool calls', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: null,
                    tool_calls: [{
                        id: 'call_123',
                        function: {
                            name: 'test_tool',
                            arguments: '{"arg":"value"}'
                        }
                    }]
                }
            }]
        });

        const tools = [{
            name: 'test_tool',
            description: 'Test tool',
            parameters: { type: 'object', properties: {} }
        }];

        const result = await provider.generate([], 'Use tool', tools);

        expect(result.toolCall).toEqual({
            skill: 'test_tool',
            params: { arg: 'value' }
        });
    });

    it('should throw error on API failure', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));
        await expect(provider.generate([], 'Hello')).rejects.toThrow('Groq API Error');
    });
});
