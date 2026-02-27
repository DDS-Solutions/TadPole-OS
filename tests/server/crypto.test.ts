/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { encryptRaw as encrypt, decryptRaw as decrypt } from '../../src/utils/crypto-core.js';

// Ensure window.crypto is available for the tests
if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = globalThis;
}

// Node 19+ has crypto built-in. For older versions or specific environments, 
// we might need to ensure subtly is available.
if (!globalThis.crypto) {
    const { webcrypto } = await import('node:crypto');
    (globalThis as any).crypto = webcrypto;
}

describe('crypto utilities', () => {
    const password = 'test-password-123';
    const secretMessage = 'The tadpole leaps at midnight.';

    it('encrypts and decrypts a message correctly', async () => {
        const encrypted = await encrypt(secretMessage, password);
        expect(encrypted).toContain('salt');
        expect(encrypted).toContain('iv');
        expect(encrypted).toContain('data');

        const decrypted = await decrypt(encrypted, password);
        expect(decrypted).toBe(secretMessage);
    });

    it('fails to decrypt with an incorrect password', async () => {
        const encrypted = await encrypt(secretMessage, password);
        await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow('Decryption failed');
    });

    it('fails to decrypt if the JSON is tampered with', async () => {
        const encrypted = await encrypt(secretMessage, password);
        const tampered = encrypted.replace(/"data":"[^"]+"/, '"data":"001122334455"');
        await expect(decrypt(tampered, password)).rejects.toThrow('Decryption failed');
    });

    it('produces different ciphertexts for the same message (unique IV/Salt)', async () => {
        const encrypted1 = await encrypt(secretMessage, password);
        const encrypted2 = await encrypt(secretMessage, password);

        expect(encrypted1).not.toBe(encrypted2);

        // Both should still decrypt to the same message
        expect(await decrypt(encrypted1, password)).toBe(secretMessage);
        expect(await decrypt(encrypted2, password)).toBe(secretMessage);
    });
});
