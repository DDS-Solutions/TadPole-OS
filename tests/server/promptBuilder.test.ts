import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../../server/promptBuilder.js';
import type { EngineAgent } from '../../server/types.js';

const mockAgent: EngineAgent = {
    id: '1',
    name: 'Test Agent',
    role: 'Security Analyst',
    department: 'Defense',
    description: 'Test',
    status: 'idle',
    tokensUsed: 0,
    workspace: './workspace/test',
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 },
    model: { provider: 'google', modelId: 'gemini-pro', apiKey: 'test' },
    skills: []
};

const soul = 'You are a helpful AI assistant.';

describe('PromptBuilder', () => {
    describe('build()', () => {
        it('should include soul, identity, and protocol in the output', () => {
            const result = PromptBuilder.build(mockAgent, soul);
            expect(result).toContain(soul);
            expect(result).toContain('Security Analyst');
            expect(result).toContain('Defense');
            expect(result).toContain('TOOL CALLING PROTOCOL');
        });

        it('should include mission context when clusterId is provided', () => {
            const result = PromptBuilder.build(mockAgent, soul, 'cluster-42');
            expect(result).toContain('Cluster cluster-42');
            expect(result).toContain('MISSION ALIGNMENT');
        });

        it('should NOT include mission context when clusterId is absent', () => {
            const result = PromptBuilder.build(mockAgent, soul);
            expect(result).not.toContain('ACTIVE MISSION');
        });
    });

    describe('buildIdentity() — structure', () => {
        it('should inject the agent role into the identity block', () => {
            // Access via build since buildIdentity is private
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('**Role**: Security Analyst');
        });

        it('should inject the workspace path', () => {
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('./workspace/test');
        });

        it('should inject the department', () => {
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('Defense department');
        });
    });

    describe('buildProtocol() — structure', () => {
        it('should include orchestrator documentation', () => {
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('ORCHESTRATION CAPABILITY');
            expect(result).toContain('callTool');
        });

        it('should include tool call syntax examples', () => {
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('<function=weather>');
            expect(result).toContain('<function=reasoning>');
        });

        it('should warn against malformed function names', () => {
            const result = PromptBuilder.build(mockAgent, '');
            expect(result).toContain('NEVER include arguments');
        });
    });

    describe('buildBaseContext() — environment', () => {
        it('should include the OS type', () => {
            const result = PromptBuilder.build(mockAgent, soul);
            expect(result).toContain('Windows');
        });

        it('should include the current working directory', () => {
            const result = PromptBuilder.build(mockAgent, soul);
            expect(result).toContain(process.cwd());
        });
    });
});
