
/**
 * @module server/skills/shell
 * @description Executes shell commands on the host machine.
 * SECURITY: This skill has full access to the host system directly via `spawn`.
 * It must be gated by the Oversight system to prevent unauthorized actions.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { Skill, SkillContext, ToolResult } from '../types.js';

interface ShellParams {
    command: string;
    cwd?: string;
    timeout?: number;
}

// Whitelist of allowed binaries to prevent arbitrary command execution.
const ALLOWED_BINARIES = new Set(['npm', 'node', 'git', 'dir', 'type', 'ls', 'cat', 'echo', 'mkdir', 'rm', 'cd', 'pwd']);

export const shellSkill: Skill<ShellParams> = {
    name: 'shell',
    description: 'Execute a shell command on the host. Supports streaming output for long-running processes.',
    intent_tags: ['system', 'cli', 'automation', 'environment'],
    schema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The command line to execute (e.g., "dir", "npm install").',
                examples: ['npm run build', 'ls -la', 'git status']
            },
            cwd: {
                type: 'string',
                description: 'Optional working directory. Absolute path recommended.',
                examples: ['./workspaces/agent-1']
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 60000).',
                examples: [30000]
            }
        },
        required: ['command'],
    },
    async execute(params: ShellParams, _context: SkillContext): Promise<ToolResult> {
        if (!params.command) throw new Error('Command is required');

        const cwd = params.cwd ? resolvePath(params.cwd) : process.cwd();

        // Path Validation
        if (params.cwd && !existsSync(cwd)) {
            return {
                success: false,
                output: {
                    error: `The directory '${params.cwd}' does not exist on this machine.`,
                    stdout: '',
                    stderr: ''
                }
            };
        }

        return new Promise((resolve) => {
            const rawArgs = params.command.trim().split(/\s+/);
            let cmd = rawArgs[0];
            const args = rawArgs.slice(1);
            const timeout = params.timeout || 60000;

            // Security: Binary Whitelisting
            if (!ALLOWED_BINARIES.has(cmd)) {
                return resolve({
                    success: false,
                    output: {
                        error: `Security Error: Command '${cmd}' is not in the system whitelist.`,
                        stdout: '',
                        stderr: ''
                    }
                });
            }

            // Security: Prevent shell-specific meta-characters even in whitelisted commands
            const forbiddenChars = /[;&|><`$()]/;
            if (params.command.match(forbiddenChars)) {
                return resolve({
                    success: false,
                    output: {
                        error: `Security Error: Command contains forbidden shell meta-characters (;&|><\`).`,
                        stdout: '',
                        stderr: ''
                    }
                });
            }

            let stdout = '';
            let stderr = '';

            // On Windows, some whitelisted commands are shell built-ins or need .cmd extension
            const isWin = process.platform === 'win32';
            let finalCmd = cmd;
            let finalArgs = args;

            if (isWin) {
                // Common built-ins or cmd-wrapped scripts
                if (['dir', 'type', 'echo', 'mkdir', 'rm', 'cd', 'pwd'].includes(cmd)) {
                    finalCmd = 'cmd.exe';
                    finalArgs = ['/c', cmd, ...args];
                } else if (['npm', 'git'].includes(cmd)) {
                    finalCmd = `${cmd}.cmd`;
                }
            }

            const child = spawn(finalCmd, finalArgs, {
                cwd,
                shell: false, // SECURITY: Disable shell interpretation
                windowsHide: true,
                env: { ...process.env, FORCE_COLOR: 'true' }
            });

            // Timeout Logic
            const timer = setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    output: {
                        error: 'Command timed out',
                        stdout,
                        stderr
                    }
                });
            }, timeout);

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({
                    success: code === 0,
                    output: {
                        code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    }
                });
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    success: false,
                    output: {
                        error: `Failed to start process: ${err.message}`,
                        stdout,
                        stderr
                    }
                });
            });
        });
    },
};
