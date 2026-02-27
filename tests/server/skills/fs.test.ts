
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fsSkill } from '../../../server/skills/fs.js';
import { promises as fs } from 'node:fs';
import path, { join } from 'node:path';

// Use a directory INSIDE the project root (process.cwd()) to satisfy sandboxing
const TEST_DIR = join(process.cwd(), 'test-sandbox_' + Date.now());

describe('FileSystem Skill', () => {
    // Setup: Create temp dir
    beforeEach(async () => {
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    const mockContext = {
        agent: {
            id: 'test-agent',
            workspace: process.cwd()
        } as any,
        callTool: vi.fn()
    } as any;

    // Teardown: Cleanup temp dir
    afterEach(async () => {
        // We use the skill itself to delete, testing 'delete' op implicitly
        // or just force cleanup
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    it('should write and read a file', async () => {
        // Path must be relative to CWD or absolute inside CWD
        // We pass a relative path to the skill, which resolves it against CWD



        // Ensure parent dir exists (the skill's write handles this, but our setup made a different dir name)
        // Let's just use the TEST_DIR we created
        const filePath = join(TEST_DIR, 'test.txt');
        // Get relative path for the skill
        const relativeFilePath = path.relative(process.cwd(), filePath);

        // Write
        const writeResult = await fsSkill.execute({
            operation: 'write',
            path: relativeFilePath,
            content: 'Hello FS'
        }, mockContext);
        expect(writeResult).toMatchObject({ result: 'success', output: { message: 'File written securely' } });

        // Read
        const readResult = await fsSkill.execute({
            operation: 'read',
            path: relativeFilePath
        }, mockContext);
        expect(readResult).toMatchObject({ result: 'success', output: { content: 'Hello FS' } });
    });

    it('should list directory contents', async () => {
        await fs.writeFile(join(TEST_DIR, 'a.txt'), 'a');
        await fs.writeFile(join(TEST_DIR, 'b.txt'), 'b');

        const relativeDirPath = path.relative(process.cwd(), TEST_DIR);

        const listResult = await fsSkill.execute({
            operation: 'list',
            path: relativeDirPath
        }, mockContext) as { result: string; output: { files: string[] } };

        expect(listResult.result).toBe('success');
        expect(listResult.output.files).toContain('a.txt');
        expect(listResult.output.files).toContain('b.txt');
    });

    it('should handle errors gracefully', async () => {
        const result = await fsSkill.execute({
            operation: 'read',
            path: 'non-existent.txt'
        }, mockContext);

        expect(result).toHaveProperty('error');
    });

    it('should block access outside sandbox', async () => {
        const result = await fsSkill.execute({
            operation: 'read',
            path: '../outside.txt'
        }, mockContext);

        expect(result.result).toBe('failed');
        expect(result.error).toContain('Security Error');
    });
});

