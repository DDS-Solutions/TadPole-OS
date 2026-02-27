/**
 * @module server/skills/recall_routine
 * @description Allows an agent to recall successful workflows from collective memory.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';
import { routineStore } from '../memory/routine_store.js';

interface RecallParams {
    intent: string;
    department?: string;
}

/**
 * Searches collective memory for routines matching the requested intent.
 */
export const recallRoutineSkill: Skill<RecallParams> = {
    name: 'recall_routine',
    description: 'Search collective memory for reusable routines matching a specific intent.',
    intent_tags: ['memory', 'search', 'experience'],
    schema: {
        type: 'object',
        properties: {
            intent: {
                type: 'string',
                description: 'The intent to search for.',
            },
            department: {
                type: 'string',
                description: 'Filter by department.',
            }
        },
        required: ['intent']
    },
    async execute(params: RecallParams, _context: SkillContext): Promise<ToolResult> {
        try {
            const routines = await routineStore.recall(params.intent, params.department);

            return {
                success: true,
                output: {
                    routines: routines.map(r => ({
                        id: r.id,
                        intent: r.intent,
                        steps: r.steps,
                        outcome: r.outcome,
                        department: r.department,
                        createdAt: r.createdAt
                    }))
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
