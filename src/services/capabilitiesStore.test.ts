import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCapabilitiesStore } from './capabilitiesStore';
import * as settingsStore from './settingsStore';

// Mock settingsStore
vi.mock('./settingsStore', () => ({
    getSettings: vi.fn(),
}));

describe('capabilitiesStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store
        useCapabilitiesStore.setState({ skills: [], workflows: [], isLoading: false, error: null });

        (settingsStore.getSettings as any).mockReturnValue({ openClawApiKey: 'test-api-key' });

        global.fetch = vi.fn();
    });

    it('should successfully fetch capabilities and sort them alphabetically', async () => {
        const mockResponse = {
            skills: [
                { name: 'b_skill', description: 'Desc B' },
                { name: 'a_skill', description: 'Desc A' }
            ],
            workflows: [
                { name: 'z_workflow', content: 'Z' },
                { name: 'y_workflow', content: 'Y' }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        await useCapabilitiesStore.getState().fetchCapabilities();

        const state = useCapabilitiesStore.getState();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.skills.length).toBe(2);

        // Verify sorting logic (must be alphabetical)
        expect(state.skills[0].name).toBe('a_skill');
        expect(state.skills[1].name).toBe('b_skill');
        expect(state.workflows[0].name).toBe('y_workflow');
        expect(state.workflows[1].name).toBe('z_workflow');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/system/capabilities'),
            expect.objectContaining({
                headers: { 'Authorization': 'Bearer test-api-key' }
            })
        );
    });

    it('should handle fetch capabilities error gracefully', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
        });

        await useCapabilitiesStore.getState().fetchCapabilities();

        const state = useCapabilitiesStore.getState();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe('Failed to fetch capabilities');
    });

    it('should save a skill and trigger a re-fetch', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ skills: [], workflows: [] })
        });

        await useCapabilitiesStore.getState().saveSkill({
            name: 'auto_skill',
            description: 'Test automatic save',
            execution_command: 'npm run test',
            schema: {}
        });

        // One for the PUT, one for the subsequent GET fetchCapabilities()
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
