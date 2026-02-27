import { encryptRaw, decryptRaw } from '../utils/crypto-core.js';

/**
 * @worker crypto.worker
 * Handles heavy cryptographic operations in a background thread.
 * Offloads PBKDF2 and AES-GCM from the main UI thread to maintain 60fps.
 */

// We don't have access to types here easily, so we use 'self as any'
const ctx: Worker = self as any;

ctx.onmessage = async (event) => {
    const { id, type, payload } = event.data;

    try {
        if (type === 'encrypt') {
            const { text, password } = payload;
            const result = await encryptRaw(text, password);
            ctx.postMessage({ id, success: true, payload: result });

        } else if (type === 'decrypt') {
            const { encryptedJson, password } = payload;
            const result = await decryptRaw(encryptedJson, password);
            ctx.postMessage({ id, success: true, payload: result });
        }
    } catch (error) {
        ctx.postMessage({ id, success: false, error: (error as Error).message });
    }
};
