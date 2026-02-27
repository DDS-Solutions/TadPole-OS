import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { OpenAIProvider } from '../../../server/providers/openai.js';
import type { ModelConfig } from '../../../server/types.js';

describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    let fetchSpy: Mock;

    const mockConfig: ModelConfig = {
        modelId: 'gpt-4-turbo',
        provider: 'openai',
        temperature: 0.7,
        baseUrl: 'https://api.openai.com/v1',
    };
    const mockApiKey = 'test-api-key';

    beforeEach(() => {
        provider = new OpenAIProvider(mockApiKey, mockConfig);
        fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with api key and config', () => {
        expect(provider).toBeDefined();
    });

    it('should call generic completion endpoint with correct headers and body', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                choices: [{
                    message: { role: 'assistant', content: 'Hello World' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            })
        };
        fetchSpy.mockResolvedValue(mockResponse);

        const result = await provider.generate([], 'Hello');

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.openai.com/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mockApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: expect.stringContaining('"model":"gpt-4-turbo"'),
            })
        );
        expect(result.text).toBe('Hello World');
        expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    });

    it('should handle tool calls correctly', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [{
                            id: 'call_123',
                            type: 'function',
                            function: {
                                name: 'test_tool',
                                arguments: '{"arg":"value"}'
                            }
                        }]
                    },
                    finish_reason: 'tool_calls'
                }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            })
        };
        fetchSpy.mockResolvedValue(mockResponse);

        const tools = [{
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: { arg: { type: 'string' } } }
        }];

        const result = await provider.generate([], 'Use the tool', tools);

        expect(result.toolCall).toEqual({
            skill: 'test_tool',
            params: { arg: 'value' }
        });

        // Check if tools were sent in the request
        const lastCall = fetchSpy.mock.calls[0];
        const body = JSON.parse(lastCall[1].body);
        expect(body.tools).toHaveLength(1);
        expect(body.tools[0].function.name).toBe('test_tool');
    });

    it('should throw error on API failure', async () => {
        const mockResponse = {
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'Invalid API Key' } })
        };
        fetchSpy.mockResolvedValue(mockResponse);

        await expect(provider.generate([], 'Hello')).rejects.toThrow('OpenAI Provider Error');
    });

    it('should map history messages correctly', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Response' } }]
            })
        };
        fetchSpy.mockResolvedValue(mockResponse);

        const history = [
            { role: 'user' as const, content: 'Hi' },
            { role: 'assistant' as const, content: 'Hello' }
        ];

        await provider.generate(history, 'Follow up');

        const lastCall = fetchSpy.mock.calls[0];
        const body = JSON.parse(lastCall[1].body);

        // System prompt + 2 history + 1 new message = 4
        expect(body.messages).toHaveLength(4);
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[1].role).toBe('user');
        expect(body.messages[2].role).toBe('assistant');
        expect(body.messages[3].role).toBe('user');
    });
});
