/**
 * @module engine/memory
 * Handles loading and saving agent memory files (SOUL.md).
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export class MemoryService {
    private soulCache: Map<string, { content: string, timestamp: number }> = new Map();
    private readonly CACHE_TTL = 1000 * 60 * 5; // 5 minute cache

    /**
     * Loads the SOUL.md file for a given agent.
     * Returns the content or a default prompt if not found.
     */
    async loadSoul(workspacePath: string): Promise<string> {
        const now = Date.now();
        const cached = this.soulCache.get(workspacePath);

        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.content;
        }

        try {
            const soulPath = join(workspacePath, 'SOUL.md');
            const content = await fs.readFile(soulPath, 'utf-8');
            this.soulCache.set(workspacePath, { content, timestamp: now });
            return content;
        } catch (error) {
            // Default system prompt if no SOUL.md exists
            const defaultPrompt = `You are an AI agent running in Tadpole OS.\nYou are helpful, precise, and focused on executing tasks.\nYou have access to a variety of tools to help you complete your work.`;
            this.soulCache.set(workspacePath, { content: defaultPrompt, timestamp: now });
            return defaultPrompt;
        }
    }

    /**
     * Ensures the workspace directory exists.
     */
    async ensureWorkspace(workspacePath: string): Promise<void> {
        await fs.mkdir(workspacePath, { recursive: true });
    }
}
