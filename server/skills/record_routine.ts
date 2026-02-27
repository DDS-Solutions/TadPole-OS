/**
 * @module server/skills/record_routine
 * @description Allows an agent to record a successful workflow as a reusable routine.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';
import { routineStore } from '../memory/routine_store.js';

interface RecordParams {
    intent: string;
    steps: {
        skill: string;
        params: any;
        result: any;
    }[];
    outcome: string;
    department?: string;
}

/**
 * Persists a successful sequence of thoughts and actions for future recall.
 */
export const recordRoutineSkill: Skill<RecordParams> = {
    name: 'record_routine',
    description: 'Record a successful multi-step workflow as a reusable routine in collective memory.',
    intent_tags: ['learning', 'memory', 'workflow'],
    schema: {
        type: 'object',
        properties: {
            intent: {
                type: 'string',
                description: 'The overarching goal of the routine.',
            },
            steps: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        skill: { type: 'string' },
                        params: { type: 'object' },
                        result: { type: 'object' }
                    },
                    required: ['skill', 'params', 'result']
                },
                description: 'The sequence of tool calls and results.',
            },
            outcome: {
                type: 'string',
                description: 'The final positive result.',
            },
            department: {
                type: 'string',
                description: 'The department this routine belongs to.',
            }
        },
        required: ['intent', 'steps', 'outcome']
    },
    async execute(params: RecordParams, _context: SkillContext): Promise<ToolResult> {
        try {
            const id = await routineStore.record({
                intent: params.intent,
                steps: params.steps,
                outcome: params.outcome,
                department: params.department || _context.agent.department || 'Operations'
            });

            return {
                success: true,
                output: {
                    message: 'Routine successfully saved.',
                    routineId: id
                }
            };
        } catch (error: any) {
            return {
                success: false,
                output: { error: error.message }
            };
        }
    },
};
