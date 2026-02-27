import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ModelManager from './ModelManager';

// Mock state using vi.hoisted for reliable sharing with vi.mock
const { mockState } = vi.hoisted(() => ({
    mockState: { isLocked: true }
}));

// Mock functions
const mockUnlock = vi.fn();
const mockLock = vi.fn();
const mockAddProvider = vi.fn();
const mockDeleteProvider = vi.fn();
const mockSetProviderConfig = vi.fn();
const mockEditProvider = vi.fn();
const mockAddModel = vi.fn();
const mockEditModel = vi.fn();
const mockDeleteModel = vi.fn();

vi.mock('../services/providerStore', () => ({
    useProviderStore: vi.fn(() => ({
        isLocked: mockState.isLocked,
        unlock: mockUnlock,
        lock: mockLock,
        setProviderConfig: mockSetProviderConfig,
        baseUrls: { openai: 'https://api.openai.com' },
        providers: [
            { id: 'openai', name: 'OpenAI', icon: '🤖', protocol: 'openai' }
        ],
        addProvider: mockAddProvider,
        deleteProvider: mockDeleteProvider,
        editProvider: mockEditProvider,
        models: [
            { id: 'm1', name: 'gpt-4', provider: 'openai', rpm: 10, tpm: 10000 }
        ],
        addModel: mockAddModel,
        editModel: mockEditModel,
        deleteModel: mockDeleteModel,
    }))
}));

describe('ModelManager Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.isLocked = true;
    });

    describe('Vault Locking Logic', () => {
        it('renders the locked vault state initially', () => {
            render(<ModelManager />);
            expect(screen.getByText(/NEURAL VAULT/i)).toBeInTheDocument();
        });

        it('calls unlock when entering passphrase and clicking unlock', async () => {
            mockUnlock.mockResolvedValue(true);
            render(<ModelManager />);

            const input = screen.getByPlaceholderText(/MASTER PASSPHRASE/i);
            const button = screen.getByText('Commit Authorization');

            fireEvent.change(input, { target: { value: 'test-pass' } });
            fireEvent.click(button);

            expect(mockUnlock).toHaveBeenCalledWith('test-pass');
        });
    });

    describe('AI Provider Manager (Unlocked)', () => {
        beforeEach(() => {
            mockState.isLocked = false;
        });

        it('renders the infrastructure header', async () => {
            render(<ModelManager />);
            expect(screen.getByText(/AI Provider Manager/i)).toBeInTheDocument();
        });

        it('calls lock when clicking the Lock Session button', () => {
            render(<ModelManager />);
            const lockButton = screen.getByText(/Lock Session/i);
            fireEvent.click(lockButton);
            expect(mockLock).toHaveBeenCalled();
        });

        it('renders existing provider cards and model identities', () => {
            render(<ModelManager />);
            // Use findall or check for multiple matches as OpenAI appears in the name and ID badge
            expect(screen.getAllByText(/OpenAI/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/GPT-4/i).length).toBeGreaterThan(0);
        });

        it('shows the Add Provider form when clicking Add Provider', () => {
            render(<ModelManager />);
            const addButton = screen.getByText(/Add Provider/i);
            fireEvent.click(addButton);
            expect(screen.getByPlaceholderText(/NAME/i)).toBeInTheDocument();
        });
    });
});
