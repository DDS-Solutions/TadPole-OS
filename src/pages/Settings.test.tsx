import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Settings from './Settings';
import * as settingsStore from '../services/settingsStore';

// Mock dependencies
vi.mock('../services/settingsStore', () => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    invalidateCache: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Settings Page', () => {
    const mockDefaultSettings = {
        openClawUrl: 'http://localhost:8000',
        openClawApiKey: 'test-key',
        theme: 'zinc',
        density: 'compact',
        defaultModel: 'GPT-4o',
        defaultTemperature: 0.7,
        autoApproveSafeSkills: true
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (settingsStore.getSettings as any).mockReturnValue(mockDefaultSettings);
        mockFetch.mockResolvedValue({ ok: true });
    });

    it('loads settings from the store on mount', async () => {
        render(<Settings />);

        expect(settingsStore.invalidateCache).toHaveBeenCalled();
        expect(settingsStore.getSettings).toHaveBeenCalled();

        await waitFor(() => {
            expect(screen.getByPlaceholderText('http://localhost:8000')).toHaveValue('http://localhost:8000');
            expect(screen.getByPlaceholderText('default: tadpole-dev-token-2026')).toHaveValue('test-key');
        });
    });

    it('updates local state when changing form fields', async () => {
        render(<Settings />);

        const urlInput = screen.getByLabelText(/Engine API URL/i);
        fireEvent.change(urlInput, { target: { value: 'http://new-url:9000', name: 'openClawUrl' } });

        expect(urlInput).toHaveValue('http://new-url:9000');

        const themeSelect = screen.getByLabelText(/Theme Base/i);
        fireEvent.change(themeSelect, { target: { value: 'slate', name: 'theme' } });
        expect(themeSelect).toHaveValue('slate');
    });

    it('calls saveSettings and syncs with backend on save', async () => {
        render(<Settings />);

        const saveButton = screen.getByText(/Save Changes/i);
        fireEvent.click(saveButton);

        expect(settingsStore.saveSettings).toHaveBeenCalledWith(mockDefaultSettings);

        // Verify fetch call to oversight settings
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('http://localhost:8000/oversight/settings'),
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ autoApproveSafeSkills: true })
            })
        );

        await waitFor(() => {
            expect(screen.getByText('Saved!')).toBeInTheDocument();
        });
    });

    it('displays validation errors from store', async () => {
        (settingsStore.saveSettings as any).mockReturnValue('INVALID_URL');
        render(<Settings />);

        const saveButton = screen.getByText(/Save Changes/i);
        fireEvent.click(saveButton);

        expect(screen.getByText('Fix Errors')).toBeInTheDocument();
        expect(screen.getByText('INVALID_URL')).toBeInTheDocument();
    });
});
