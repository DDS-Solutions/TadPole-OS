import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'mock-uuid-1234' },
    writable: true,
});

import { getSettings, saveSettings, invalidateCache } from '../src/services/settingsStore';

describe('settingsStore', () => {
    beforeEach(() => {
        localStorageMock.clear();
        invalidateCache();
    });

    it('returns defaults when localStorage is empty', () => {
        const settings = getSettings();
        expect(settings.openClawUrl).toBe('http://localhost:8000');
        expect(settings.openClawApiKey).toBe('tadpole-dev-token-2026');
    });

    it('saves and retrieves settings', () => {
        saveSettings({
            openClawUrl: 'http://myserver:9000',
            openClawApiKey: 'test-key-123',
            defaultModel: 'GPT-5.2',
            theme: 'zinc',
            density: 'compact',
            defaultTemperature: 0.7,
            autoApproveSafeSkills: true,
        });
        invalidateCache();
        const settings = getSettings();
        expect(settings.openClawUrl).toBe('http://myserver:9000');
        expect(settings.openClawApiKey).toBe('test-key-123');
    });

    it('obfuscates API key in localStorage', () => {
        saveSettings({
            openClawUrl: 'http://localhost:8000',
            openClawApiKey: 'secret-key',
            defaultModel: 'GPT-5.2',
            theme: 'zinc',
            density: 'compact',
            defaultTemperature: 0.7,
            autoApproveSafeSkills: true,
        });
        const raw = localStorageMock.getItem('tadpole_settings');
        expect(raw).toBeTruthy();
        expect(raw!.includes('secret-key')).toBe(false);
    });

    it('rejects invalid URLs', () => {
        const error = saveSettings({
            openClawUrl: 'ftp://bad-protocol.com',
            openClawApiKey: '',
            defaultModel: 'GPT-5.2',
            theme: 'zinc',
            density: 'compact',
            defaultTemperature: 0.7,
            autoApproveSafeSkills: true,
        });
        expect(error).toBeTruthy();
        expect(error).toContain('URL');
    });

    it('accepts valid http URLs', () => {
        const error = saveSettings({
            openClawUrl: 'http://localhost:8000',
            openClawApiKey: '',
            defaultModel: 'GPT-5.2',
            theme: 'zinc',
            density: 'compact',
            defaultTemperature: 0.7,
            autoApproveSafeSkills: true,
        });
        expect(error).toBeNull();
    });

    it('accepts valid https URLs', () => {
        const error = saveSettings({
            openClawUrl: 'https://api.example.com',
            openClawApiKey: '',
            defaultModel: 'GPT-5.2',
            theme: 'zinc',
            density: 'compact',
            defaultTemperature: 0.7,
            autoApproveSafeSkills: true,
        });
        expect(error).toBeNull();
    });

    it('updates cache in-place after save (no invalidation needed)', () => {
        // Save new settings
        saveSettings({
            openClawUrl: 'http://new-host:9000',
            openClawApiKey: 'new-key',
            defaultModel: 'Gemini-2.5',
            theme: 'dark',
            density: 'comfortable',
            defaultTemperature: 0.5,
            autoApproveSafeSkills: false,
        });
        // getSettings should return new values WITHOUT calling invalidateCache()
        const settings = getSettings();
        expect(settings.openClawUrl).toBe('http://new-host:9000');
        expect(settings.openClawApiKey).toBe('new-key');
        expect(settings.defaultModel).toBe('Gemini-2.5');
        expect(settings.defaultTemperature).toBe(0.5);
    });
});
