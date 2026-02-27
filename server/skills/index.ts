/**
 * @module server/skills/index
 * @description Central registry for all available system skills.
 * Allows the runner to retrieve tool definitions and implementations dynamically.
 */

import type { Skill } from '../types.js';
import { shellSkill } from './shell.js';
import { fetchSkill } from './fetch.js';
import { fsSkill } from './fs.js';
import { reasoningSkill } from './reasoning.js';
import { weatherSkill } from './weather.js';
import { delegateTaskSkill } from './delegate_task.js';
import { orchestratorSkill } from './orchestrator.js';
import { recallRoutineSkill } from './recall_routine.js';
import { recordRoutineSkill } from './record_routine.js';

// Map of skill names to their implementations
export const skillRegistry: Record<string, Skill> = {
    shell: shellSkill,
    fetch: fetchSkill,
    fs: fsSkill,
    reasoning: reasoningSkill,
    weather: weatherSkill,
    delegate_task: delegateTaskSkill,
    orchestrator: orchestratorSkill,
    recall_routine: recallRoutineSkill,
    record_routine: recordRoutineSkill
};

/**
 * Returns a list of all available tool definitions formatted for the LLM,
 * filtered by the agent's department to enforce structural guardrails.
 * 
 * @param department The agent's department.
 * @returns Array of tool schemas allowed for that department.
 */
export const getAvailableTools = (department: string) => {
    return Object.values(skillRegistry)
        .filter(skill => {
            // Enforcement Logic:
            // 1. Core reasoning is always allowed.
            if (skill.name === 'reasoning') return true;

            // 2. Engineering & Operations have full access.
            if (department === 'Engineering' || department === 'Operations' || department === 'Executive') return true;

            // 3. Marketing & Product restriction: No shell/fs/orchestrator (mutations/complex logic)
            if (department === 'Marketing' || department === 'Product' || department === 'Design') {
                return !['shell', 'fs', 'orchestrator'].includes(skill.name);
            }

            // 4. Quality Assurance: Access to logs and reasoning, but restricted shell/orchestrator.
            if (department === 'Quality Assurance') {
                return !['shell', 'orchestrator'].includes(skill.name);
            }

            // Default: Base skills only
            return ['reasoning', 'fetch', 'weather'].includes(skill.name);
        })
        .map(skill => ({
            name: skill.name,
            description: skill.description,
            parameters: skill.schema
        }));
};
