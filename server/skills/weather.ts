/**
 * @module server/skills/weather
 * @description Retrieves real-time weather information using wttr.in.
 * Supports location-based queries and returns a concise summary.
 */

import type { Skill, SkillContext, ToolResult } from '../types.js';

interface WeatherParams {
    location: string;
    format?: string;
    days?: number;
    unit?: string;
}

export const weatherSkill: Skill<WeatherParams> = {
    name: 'weather',
    description: 'Get the current weather for a specified location.',
    intent_tags: ['weather', 'environment', 'external-data'],
    schema: {
        type: 'object',
        properties: {
            location: {
                type: 'string',
                description: 'The city and country (e.g., "Paris, France").',
                examples: ['London, UK', 'Tokyo, Japan']
            },
            unit: {
                type: 'string',
                enum: ['m', 'u'],
                description: 'm for Metric (Celsius), u for USCS (Fahrenheit).',
                examples: ['m', 'u']
            }
        },
        required: ['location']
    },
    async execute(params: WeatherParams, _context: SkillContext): Promise<ToolResult> {
        try {
            // Internal Logic: Default to 0 days (current weather)
            // Llama 3.3 is more reliable with fewer schema parameters.
            const days = 0;

            const query = encodeURIComponent(params.location);
            let urlParams = '';

            // Force format=3 for high-performance, token-efficient concise output
            // wttr.in format=3 is a ultra-compact one-liner: "Paris, France: ⛅️ +17°C"
            urlParams += `?format=3`;

            // Add days if provided (wttr.in uses a number directly as a query param)
            if (days !== undefined && days > 0 && days <= 3) {
                urlParams += `&${days}`;
            }

            // Add unit if provided (m for Metric, u for USCS)
            if (params.unit && (params.unit === 'm' || params.unit === 'u')) {
                urlParams += `&${params.unit}`;
            }

            const url = `https://wttr.in/${query}${urlParams}`;

            console.log(`[Weather] Fetching data for: ${params.location} with URL: ${url}...`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Weather service returned ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();

            return {
                success: true,
                output: {
                    location: params.location,
                    summary: text.trim()
                }
            };
        } catch (error: any) {
            console.error('[Weather] Failed to fetch weather:', error);
            return {
                success: false,
                output: { error: error.message }
            };
        }
    },
};
