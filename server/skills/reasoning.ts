
/**
 * @module server/skills/reasoning
 * @description Implements the Aletheia Reasoning Protocol.
 * Forces the agent to "think" in structured steps before acting.
 */
import type { Skill, SkillContext, ToolResult } from '../types.js';

interface ReasoningParams {
    step: string;
    content: string;
}

export const reasoningSkill: Skill<ReasoningParams> = {
    name: 'reasoning',
    description: 'Log a reasoning step (Hypothesis, Critique, Verification, Decision). You MUST use this to plan before taking action.',
    intent_tags: ['planning', 'cognition', 'strategy', 'internal'],
    schema: {
        type: 'object',
        properties: {
            step: {
                type: 'string',
                description: 'Reasoning step name.',
                examples: ['Hypothesis', 'Critique', 'Verification', 'Decision']
            },
            content: {
                type: 'string',
                description: 'The thought content.',
                examples: ['I will check the configuration file for any misaligned ports.']
            }
        },
        required: ['step', 'content'],
    },
    async execute(params: ReasoningParams, _context: SkillContext): Promise<ToolResult> {
        // This skill is unique: it doesn't "do" anything external.
        // It simply logs the thought for the system to record.
        // The Runner will see this output and add it to history.
        return {
            success: true,
            output: {
                message: `[${params.step}] ${params.content}`
            }
        };
    },
};
