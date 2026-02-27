import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks MUST be defined at the top level to be hoisted correctly
vi.mock('../utils/crypto', () => ({
    encrypt: vi.fn(async (text: string) => `encrypted_${text}`),
    decrypt: vi.fn(async (encrypted: string) => encrypted.replace('encrypted_', '')),
}));

// Use vi.hoisted for environment mocks
vi.hoisted(() => {
    const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        clear: vi.fn(),
        removeItem: vi.fn(),
        length: 0,
        key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
});

import { useProviderStore } from './providerStore';

describe('providerStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('starts in a locked state by default', () => {
        const { isLocked } = useProviderStore.getState();
        expect(isLocked).toBe(true);
    });

    it('unlocks with the correct passphrase and locks back', async () => {
        const { unlock, lock } = useProviderStore.getState();

        const success = await unlock('test-pass');
        expect(success).toBe(true);
        expect(useProviderStore.getState().isLocked).toBe(false);

        lock();
        expect(useProviderStore.getState().isLocked).toBe(true);
    });

    it('updates provider configuration', async () => {
        const { setProviderConfig, unlock } = useProviderStore.getState();

        await unlock('test-pass');
        await setProviderConfig('openai', 'xyz', 'https://custom-proxy.com');

        const { baseUrls } = useProviderStore.getState();
        expect(baseUrls.openai).toBe('https://custom-proxy.com');
        expect(useProviderStore.getState().encryptedConfigs.openai).toBe('encrypted_xyz');
    });
});
