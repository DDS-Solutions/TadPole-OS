/**
 * @module server/promptBuilder
 * @description Helper class to construct the system prompt for agents.
 * Centralizes all identity, context, and protocol injection logic.
 */
import type { EngineAgent } from './types.js';

export class PromptBuilder {
    /**
     * Builds the complete system prompt for an agent.
     * @param agent The agent configuration.
     * @param clusterId Optional ID of the active mission cluster.
     */
    static build(agent: EngineAgent, soul: string, clusterId?: string): string {
        const base = this.buildBaseContext(agent, soul);
        const identity = this.buildIdentity(agent);
        const protocol = this.buildProtocol();
        const mission = clusterId ? this.buildMissionContext(clusterId) : '';

        return `${base}\n\n${identity}\n\n${mission}\n\n${protocol}`;
    }

    private static buildBaseContext(agent: EngineAgent, soul: string): string {
        return `
${soul}

# AGENT OPERATING ENVIRONMENT
- **OS**: Windows (Standard commands: dir, type, powershell)
- **Host Root**: ${process.cwd()}
- **Workspace**: ${agent.workspace}
- **Protocol**: Use the 'reasoning' tool to plan (Hypothesis -> Critique -> Verification -> Decision).
`;
    }

    private static buildIdentity(agent: EngineAgent): string {
        return `
# YOUR IDENTITY
- **Role**: ${agent.role}
- **Department**: ${agent.department}

# OPERATING CONSTRAINTS
- You are currently operating within the ${agent.department} department.
- Your workspace is restricted to: ${agent.workspace}
- All actions must be aligned with your role as a ${agent.role}.
`;
    }

    private static buildMissionContext(clusterId: string): string {
        return `
# ACTIVE MISSION: [Cluster ${clusterId}]
- You are participating in a collaborative mission cluster.
- MISSION ALIGNMENT IS YOUR HIGHEST PRIORITY.
`;
    }

    private static buildProtocol(): string {
        return `
# ORCHESTRATION CAPABILITY
- Use 'orchestrator' for multi-step logic, loops, or complex tool sequences.
- Inside orchestrator scripts, use:
    - \`await callTool('skill_name', { params })\`: Invokes any other tool.
    - \`log('message')\`: Records debug information.
- This is significantly faster than turn-by-turn tool calls.

# TOOL CALLING PROTOCOL (STRICT)
- ALWAYS generate tool calls using the defined function-calling schema.
- NEVER include arguments or JSON in the function name (e.g., NAME: "weather", NOT "weather,{\"location\":...}").
- NEVER omit the closing '>' in the tool tag.

## EXAMPLE SYNTAX:
<function=weather>{"location": "Paris, France"}</function>
<function=reasoning>{"step": "Analyze the request", "thought": "I need to check the weather first."}</function>
`;
    }
}
