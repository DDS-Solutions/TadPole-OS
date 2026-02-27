/**
 * @file tests/api_ai_readiness.test.ts
 * @description Verification suite for Phase 8: API AI-Readiness & AX.
 * Tests RFC 9457 compliance and machine-readable contract generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Gateway } from '../server/gateway.js';

const TEST_PORT = 4999;
const NEURAL_TOKEN = 'test-token-phase-8';

describe('Phase 8: API AI-Readiness & AX', () => {
    let gateway: Gateway;

    beforeAll(async () => {
        process.env.NEURAL_TOKEN = NEURAL_TOKEN;
        gateway = new Gateway(TEST_PORT);
        await gateway.start();
    });

    afterAll(async () => {
        await gateway.stop();
    });

    it('should return RFC 9457 Problem Details for unauthorized requests', async () => {
        const response = await fetch(`http://localhost:${TEST_PORT}/engine/kill`, { method: 'POST' });
        expect(response.status).toBe(401);
        expect(response.headers.get('content-type')).toContain('application/problem+json');

        const problem = await response.json();
        expect(problem).toMatchObject({
            type: 'https://tadpole.ai/probs/unauthorized',
            title: 'Unauthorized Access',
            status: 401,
            detail: 'Missing or invalid Neural Token.'
        });
    });

    it('should return a dynamic OpenAPI manifest with x-tadpole-skills', async () => {
        const response = await fetch(`http://localhost:${TEST_PORT}/openapi.json`);
        expect(response.status).toBe(200);

        const spec = await response.json();
        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('Tadpole OS Engine');

        // Verify custom extension for Agentic Discoverability
        expect(spec['x-tadpole-skills']).toBeDefined();
        expect(Array.isArray(spec['x-tadpole-skills'])).toBe(true);

        // Check for specific enriched metadata
        const shellSkill = spec['x-tadpole-skills'].find((s: any) => s.name === 'shell');
        expect(shellSkill).toBeDefined();
        expect(shellSkill.intent_tags).toContain('system');
        expect(shellSkill.parameters.properties.command.examples).toContain('npm run build');
    });

    it('should include ProblemDetails schema in OpenAPI components', async () => {
        const response = await fetch(`http://localhost:${TEST_PORT}/openapi.json`);
        const spec = await response.json();

        expect(spec.components.schemas.ProblemDetails).toBeDefined();
        expect(spec.components.schemas.ProblemDetails.properties.status.type).toBe('integer');
    });
});
