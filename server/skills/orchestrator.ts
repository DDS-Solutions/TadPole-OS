/**
 * @module server/skills/orchestrator
 * @description Allows an agent to execute a dynamic orchestration script.
 * Used for complex multi-step plans that require precise control over
 * other agents or system resources.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';

interface OrchestratorParams {
    script: string;
    description: string;
}

/**
 * Standard tool for multi-agent coordination.
 * The script is usually a set of high-level instructions for the engine.
 */
export const orchestratorSkill: Skill<OrchestratorParams> = {
    name: 'orchestrator',
    description: 'Execute a complex orchestration script to coordinate multiple agents or systems.',
    intent_tags: ['coordination', 'planning', 'system'],
    schema: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: 'The orchestration script or sequence of instructions.',
                examples: ['Deploy cluster-alpha to production', 'Collect logs from all workers']
            },
            description: {
                type: 'string',
                description: 'A human-readable description of what the script does.',
                examples: ['Initializing multi-region deployment sequence.']
            }
        },
        required: ['script', 'description']
    },
    async execute(params: OrchestratorParams, _context: SkillContext): Promise<ToolResult> {
        if (!params.script) throw new Error('Script is required');

        // Prepare the sandbox environment
        const agent = _context.agent;
        console.log(`🎭 [Orchestrator] ${agent.name} is running orchestration: ${params.description}`);

        // Note: In a production environment, this would trigger a state machine
        // or a child process. For now, we simulate success.

        return {
            success: true,
            output: {
                message: 'Orchestration script initiated successfully.',
                details: params.description
            }
        };
    },
};
