/**
 * @module server/skills/fetch
 * @description Skill to fetch content from a URL.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';

interface FetchParams {
    url: string;
}

export const fetchSkill: Skill<FetchParams> = {
    name: 'fetch',
    description: 'Fetch the raw content of a URL (HTML, JSON, Text).',
    intent_tags: ['research', 'data', 'external'],
    schema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to fetch.',
                examples: ['https://google.com', 'https://api.github.com']
            }
        },
        required: ['url'],
    },
    async execute(params: FetchParams, _context: SkillContext): Promise<ToolResult> {
        if (!params.url) throw new Error('URL is required');

        try {
            // --- Neural Firewall: SSRF Protection ---
            const url = new URL(params.url);
            const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
            if (blockedHosts.includes(url.hostname)) {
                return {
                    success: false,
                    output: {
                        error: 'Access to internal or local networks is restricted (Neural Firewall)'
                    }
                };
            }

            const response = await fetch(params.url);
            const text = await response.text();

            return {
                success: true,
                output: {
                    content: text.length > 5000 ? text.substring(0, 5000) + '... (truncated)' : text
                }
            };
        } catch (error: any) {
            return {
                success: false,
                output: {
                    error: error.message
                }
            };
        }
    },
};
