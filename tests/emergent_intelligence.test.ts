import { describe, it, expect, beforeEach, vi } from 'vitest';
import { delegateTaskSkill } from '../server/skills/delegate_task.js';
import { recordRoutineSkill } from '../server/skills/record_routine.js';
import { recallRoutineSkill } from '../server/skills/recall_routine.js';
import { routineStore } from '../server/memory/routine_store.js';
import type { SkillContext, EngineAgent } from '../server/types.js';

describe('Phase 7: Emergent Intelligence & Observability', () => {
    beforeEach(async () => {
        await routineStore.clear();
    });

    const mockAgent: EngineAgent = {
        id: 'A-1',
        name: 'Test Agent',
        role: 'Engineer',
        department: 'Engineering',
        description: 'Testing intelligence',
        status: 'idle',
        skills: [],
        workspace: './test',
        tokensUsed: 0,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 },
        model: { provider: 'google', modelId: 'gemini-pro' }
    };

    const mockContext: SkillContext = {
        agent: mockAgent,
        callTool: vi.fn(),
        clusterId: 'C-001'
    };

    describe('Mission Briefing Protocol', () => {
        it('should generate a formal MissionBrief on delegation', async () => {
            const params = {
                targetClusterId: 'C-999',
                primaryObjective: 'Analyze security logs',
                constraints: ['No external fetch', 'Max duration 5m'],
                successCriteria: ['List all 401 errors', 'Identify source IPs']
            };

            const result = await delegateTaskSkill.execute(params, mockContext);
            expect(result.success).toBe(true);
            expect(result.output.handoff.brief).toBeDefined();
            expect(result.output.handoff.brief.missionId).toMatch(/^M-[A-Z0-9]{6}/);
            expect(result.output.handoff.brief.primaryObjective).toBe(params.primaryObjective);
            expect(result.output.handoff.brief.constraints).toContain('No external fetch');
        });
    });

    describe('Neural Procedural Memory (RoutineStore)', () => {
        it('should record and recall successful routines', async () => {
            const intent = 'Fixing build errors in Node.js';
            const steps = [
                { skill: 'shell', params: { command: 'npm run build' }, result: { success: false, error: 'missing dep' } },
                { skill: 'shell', params: { command: 'npm install' }, result: { success: true } },
                { skill: 'shell', params: { command: 'npm run build' }, result: { success: true } }
            ];
            const outcome = 'Build succeeded after dep install';

            // 1. Record
            const recordResult = await recordRoutineSkill.execute({ intent, steps, outcome }, mockContext);
            expect(recordResult.success).toBe(true);
            const routineId = recordResult.output.routineId;

            // 2. Recall
            const recallResult = await recallRoutineSkill.execute({ intent: 'Node.js build' }, mockContext);
            expect(recallResult.success).toBe(true);
            expect(recallResult.output.routines.length).toBeGreaterThan(0);
            expect(recallResult.output.routines[0].id).toBe(routineId);
            expect(recallResult.output.routines[0].steps.length).toBe(3);
        });
    });
});
