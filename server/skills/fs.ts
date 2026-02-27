
/**
 * @module server/skills/fs
 * @description Secure filesystem operations with sandboxing.
 * Enforces all operations to remain within the configured workspace.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Skill, SkillContext, ToolResult } from '../types.js';

// Configuration: Defines the root of the sandbox.
// In a real deployment, this should be configurable per agent.
const SANDBOX_ROOT = path.resolve(process.cwd()); // Default to CWD for now, but enforced.

/**
 * Validates that a path is within the sandbox.
 * @param targetPath The path to check.
 * @throws Error if path escapes sandbox.
 */
function validatePath(targetPath: string) {
    const resolved = path.resolve(SANDBOX_ROOT, targetPath);
    if (!resolved.startsWith(SANDBOX_ROOT)) {
        throw new Error(`Security Error: Access denied to ${targetPath}. Path escapes sandbox.`);
    }

    // Security: Sensitive File Blacklist
    const filename = path.basename(resolved).toLowerCase();
    if (filename.includes('.env') || filename === 'credentials.json' || filename === 'token.json') {
        throw new Error(`Security Error: Access to sensitive file '${filename}' is strictly prohibited.`);
    }

    return resolved;
}

interface FsParams {
    operation: 'read' | 'write' | 'list' | 'mkdir' | 'delete';
    path: string;
    content?: string;
}

export const fsSkill: Skill<FsParams> = {
    name: 'fs',
    description: 'Read and write files securely within the workspace.',
    intent_tags: ['file', 'storage', 'data', 'persistence'],
    schema: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['read', 'write', 'list', 'mkdir', 'delete'],
                description: 'The operation to perform.',
                examples: ['read', 'write']
            },
            path: {
                type: 'string',
                description: 'The relative path within the workspace.',
                examples: ['package.json', 'src/index.ts']
            },
            content: {
                type: 'string',
                description: 'Content to write (for "write" operation).',
                examples: ['{ "version": "1.0.0" }']
            }
        },
        required: ['operation', 'path'],
    },
    async execute(params: FsParams, _context: SkillContext): Promise<ToolResult> {
        if (!params.path) throw new Error('Path is required');

        try {
            const targetPath = validatePath(params.path);

            switch (params.operation) {
                case 'read': {
                    const content = await fs.readFile(targetPath, 'utf-8');
                    return { success: true, result: 'success', output: { content } };
                }
                case 'write': {
                    if (typeof params.content !== 'string') throw new Error('Content is required for write');

                    // Atomic write pattern: Write to temp file then rename
                    const tempPath = `${targetPath}.tmp.${Date.now()}`;
                    await fs.mkdir(path.dirname(targetPath), { recursive: true });
                    await fs.writeFile(tempPath, params.content, 'utf-8');
                    await fs.rename(tempPath, targetPath);

                    return { success: true, result: 'success', output: { message: 'File written securely' } };
                }
                case 'list': {
                    const files = await fs.readdir(targetPath);
                    return { success: true, result: 'success', output: { files } };
                }
                case 'mkdir': {
                    await fs.mkdir(targetPath, { recursive: true });
                    return { success: true, result: 'success', output: { message: 'Directory created' } };
                }
                case 'delete': {
                    await fs.rm(targetPath, { recursive: true, force: true });
                    return { success: true, result: 'success', output: { message: 'Path deleted' } };
                }
                default:
                    throw new Error(`Unknown operation: ${params.operation}`);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                result: 'failed',
                output: { error: errorMessage },
                error: errorMessage
            };
        }
    },
};
