import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../../../server/providers/gemini.js';
import type { ModelConfig } from '../../../server/types.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => ({
    mockGenerateContent: vi.fn(),
    mockGetGenerativeModel: vi.fn() // Initialize as empty mock first
}));

// Configure behavior
mockGetGenerativeModel.mockReturnValue({
    generateContent: mockGenerateContent
});

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(function () {
        return {
            getGenerativeModel: mockGetGenerativeModel
        };
    })
}));

describe('GeminiProvider', () => {
    let provider: GeminiProvider;
    const mockConfig: ModelConfig = {
        modelId: 'gemini-pro',
        provider: 'google',
        temperature: 0.5,
        systemPrompt: 'System instructions'
    };
    const mockApiKey = 'test-api-key';

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new GeminiProvider(mockApiKey, mockConfig);
    });

    it('should initialize successfully', () => {
        expect(GoogleGenerativeAI).toHaveBeenCalledWith(mockApiKey);
        expect(mockGetGenerativeModel).toHaveBeenCalledWith({
            model: 'gemini-pro',
            systemInstruction: 'System instructions',
            generationConfig: { temperature: 0.5 }
        });
        expect(provider).toBeDefined();
    });

    it('should generate text response', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'Gemini Response',
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30
                },
                functionCalls: () => []
            }
        });

        const result = await provider.generate([], 'Hello');

        expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
            contents: expect.arrayContaining([
                expect.objectContaining({
                    role: 'user',
                    parts: [{ text: 'Hello' }]
                })
            ])
        }));

        expect(result.text).toBe('Gemini Response');
        expect(result.usage).toEqual({
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30
        });
    });

    it('should handle function calls', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => '',
                usageMetadata: undefined,
                functionCalls: () => [{
                    name: 'test_tool',
                    args: { arg: 'value' }
                }]
            }
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

    it('should map history correctly', async () => {
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'Response',
                usageMetadata: undefined,
                functionCalls: () => []
            }
        });

        const history = [
            { role: 'user' as const, content: 'User 1' },
            { role: 'assistant' as const, content: 'Model 1' }
        ];

        await provider.generate(history, 'User 2');

        const callArgs = mockGenerateContent.mock.calls[0][0];
        const contents = callArgs.contents;

        expect(contents).toHaveLength(3);
        expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'User 1' }] });
        expect(contents[1]).toEqual({ role: 'model', parts: [{ text: 'Model 1' }] });
        expect(contents[2]).toEqual({ role: 'user', parts: [{ text: 'User 2' }] });
    });
});
