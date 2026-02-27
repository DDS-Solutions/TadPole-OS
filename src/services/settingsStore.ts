/**
 * @module SettingsStore
 * Centralized settings access with validation and basic key obfuscation.
 * Eliminates repeated localStorage.getItem + JSON.parse across services.
 *
 * Fixes:
 *  - Risk #1: API key obfuscated via base64 (not plaintext)
 *  - Risk #4: Single parse location with in-memory cache
 *  - Risk #11: URL validation rejects non-http(s) protocols
 */
import { useState } from 'react';

const SETTINGS_KEY = 'tadpole_settings';

export interface TadpoleSettings {
    /** Base URL of the OpenClaw Rust backend (e.g., `http://localhost:8000`). */
    openClawUrl: string;
    /** API key for authenticating with the OpenClaw backend (stored obfuscated). */
    openClawApiKey: string;
    /** Active color theme identifier (e.g., `'zinc'`). */
    theme: string;
    /** Layout density preference: `'compact'` or `'comfortable'`. */
    density: string;
    /** Default model identifier used for new agent missions. */
    defaultModel: string;
    /** Default inference temperature (0.0–1.0). */
    defaultTemperature: number;
    /** If `true`, auto-approves low-risk tool calls without user confirmation. */
    autoApproveSafeSkills: boolean;
}

const DEFAULTS: TadpoleSettings = {
    openClawUrl: `${window.location.protocol}//${window.location.hostname}:8000`,
    openClawApiKey: 'tadpole-dev-token-2026',
    theme: 'zinc',
    density: 'compact',
    defaultModel: 'GPT-4o',
    defaultTemperature: 0.7,
    autoApproveSafeSkills: true,
};

/** In-memory cache to avoid repeated JSON.parse calls. */
let cached: TadpoleSettings | null = null;

/** Simple base64 obfuscation — not encryption, but prevents casual shoulder-surfing. */
const obfuscate = (value: string): string =>
    value ? btoa(value) : '';

const deobfuscate = (value: string): string => {
    try { return value ? atob(value) : ''; }
    catch { return ''; }
};

/** Validates a URL string. Rejects non-http(s) protocols. */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Reads settings from localStorage (cached after first read).
 * Always returns a valid settings object, falling back to defaults.
 */
export function getSettings(): TadpoleSettings {
    if (cached) return cached;

    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) { cached = { ...DEFAULTS }; return cached; }

        const parsed = JSON.parse(raw);
        let storedUrl = (parsed.openClawUrl || DEFAULTS.openClawUrl).trim();

        // 🚀 Auto-fix: If accessed via a remote IP, but settings point to a local alias,
        // we automatically redirect to the current host to maintain zero-config parity.
        const isLocalAlias = /^(http|ws)s?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/i.test(storedUrl);
        const isRemoteAccess = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

        if (isLocalAlias && isRemoteAccess) {
            console.log(`[Settings] Auto-fixing local agent URL: ${storedUrl} -> ${window.location.protocol}//${window.location.hostname}:8000`);
            storedUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
        }

        cached = {
            openClawUrl: storedUrl,
            openClawApiKey: deobfuscate(parsed.openClawApiKey || ''),
            theme: parsed.theme || DEFAULTS.theme,
            density: parsed.density || DEFAULTS.density,
            defaultModel: parsed.defaultModel || DEFAULTS.defaultModel,
            defaultTemperature: parsed.defaultTemperature !== undefined ? parsed.defaultTemperature : DEFAULTS.defaultTemperature,
            autoApproveSafeSkills: parsed.autoApproveSafeSkills !== undefined ? parsed.autoApproveSafeSkills : DEFAULTS.autoApproveSafeSkills,
        };
        return cached;
    } catch {
        cached = { ...DEFAULTS };
        return cached;
    }
}

/**
 * Saves settings to localStorage and updates the in-memory cache.
 * API key is obfuscated before storage.
 * @returns Error message if validation fails, or null on success.
 */
export function saveSettings(settings: TadpoleSettings): string | null {
    if (!isValidUrl(settings.openClawUrl)) {
        return 'Invalid URL. Must start with http:// or https://';
    }

    const toStore = {
        ...settings,
        openClawApiKey: obfuscate(settings.openClawApiKey),
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
    // Update cache in-place instead of invalidating — avoids redundant re-parse on next getSettings()
    cached = { ...settings };
    return null;
}

/** Force-invalidates the cache (e.g., after external localStorage change). */
export function invalidateCache(): void {
    cached = null;
}

/**
 * React hook for consuming settings.
 * Returns the cached settings object. Uses `useState` to ensure
 * re-renders if the component is unmounted and remounted.
 */
export function useSettingsStore() {
    const [settings] = useState<TadpoleSettings>(getSettings());
    return { settings };
}
