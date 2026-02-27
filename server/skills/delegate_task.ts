/**
 * @module server/skills/delegate_task
 * @description Allows an Alpha node to delegate a sub-task to another mission cluster.
 * This skill facilitates cross-cluster negotiation and workflow pipelining.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';

interface DelegateTaskParams {
    /** The ID of the mission cluster to receive the task. */
    targetClusterId: string;
    /** A high-level description of the objective. */
    primaryObjective: string;
    /** Specific constraints (e.g., "Max budget $50", "No shell access"). */
    constraints?: string[];
    /** What defines success for this sub-mission. */
    successCriteria?: string[];
    /** Optional structured data needed for the task logic. */
    contextData?: Record<string, any>;
    /** Mission urgency. */
    priority?: 'standard' | 'high' | 'critical';
}

/**
 * Allows an Alpha node to delegate a sub-task to another mission cluster.
 * Implements the Formal Mission Briefing Protocol (Industry Standard).
 */
export const delegateTaskSkill: Skill<DelegateTaskParams> = {
    name: 'delegate_task',
    description: 'Delegate a specialized sub-mission to another cluster with a formal objective and constraints.',
    intent_tags: ['coordination', 'delegation', 'swarm', 'cluster'],
    schema: {
        type: 'object',
        properties: {
            targetClusterId: {
                type: 'string',
                description: 'The ID of the target cluster.',
                examples: ['C-ALPHA', 'C-ENGINEER']
            },
            primaryObjective: {
                type: 'string',
                description: 'The core goal of the sub-mission.',
                examples: ['Deploy security patches', 'Audit resource usage']
            },
            constraints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Operational boundaries and limits.',
                examples: [['No shell access', 'Read-only fs']]
            },
            successCriteria: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific outcomes required for completion.',
                examples: [['All tests pass', 'Latency < 50ms']]
            },
            contextData: {
                type: 'object',
                description: 'Technical context or temporary parameters.',
                examples: [{ repo: 'tadpole-os', branch: 'main' }]
            },
            priority: {
                type: 'string',
                enum: ['standard', 'high', 'critical'],
                description: 'Mission urgency level.',
                examples: ['standard', 'critical']
            }
        },
        required: ['targetClusterId', 'primaryObjective']
    },
    async execute(params: DelegateTaskParams, _context: SkillContext): Promise<ToolResult> {
        const brief = {
            missionId: `M-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            primaryObjective: params.primaryObjective,
            constraints: params.constraints || [],
            successCriteria: params.successCriteria || [],
            contextVault: params.contextData,
            createdAt: new Date().toISOString()
        };

        console.log(`📡 [Mission Control] Delegating to ${params.targetClusterId}: ${brief.missionId}`);

        return {
            success: true,
            output: {
                handoff: {
                    type: 'incoming_task',
                    targetClusterId: params.targetClusterId,
                    brief,
                    priority: params.priority || 'standard'
                }
            }
        };
    },
};
