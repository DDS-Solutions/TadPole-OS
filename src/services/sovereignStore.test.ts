import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSovereignStore } from './sovereignStore';

describe('sovereignStore', () => {
    beforeEach(() => {
        // Clear store to a pristine state before each test
        useSovereignStore.setState({ messages: [], activeScope: 'agent', isDetached: false });
        vi.clearAllMocks();
    });

    it('should add a unique message and assign an ID automatically', () => {
        useSovereignStore.getState().addMessage({
            senderId: 'sys_1',
            senderName: 'System',
            text: 'Hello World',
            scope: 'agent'
        });

        const msgs = useSovereignStore.getState().messages;
        expect(msgs.length).toBe(1);
        expect(msgs[0].id).toBeDefined(); // Unique ID should be created
        expect(msgs[0].text).toBe('Hello World');
    });

    it('should prevent adding duplicate messages by ID (synchronization test)', () => {
        const dupeId = 'message_uuid_1234';

        // Add initial message
        useSovereignStore.getState().addMessage({
            id: dupeId,
            senderId: 'sys_1',
            senderName: 'System',
            text: 'Original Content',
            scope: 'agent'
        });

        expect(useSovereignStore.getState().messages.length).toBe(1);

        // Attempt to add a message with the exact same ID (simulating a BroadcastChannel cross-tab hit)
        useSovereignStore.getState().addMessage({
            id: dupeId,
            senderId: 'sys_1',
            senderName: 'System',
            text: 'Duplicate content that should be blocked',
            scope: 'agent'
        });

        // Length should still be 1, content should be the Original Content because it was deduplicated
        const msgs = useSovereignStore.getState().messages;
        expect(msgs.length).toBe(1);
        expect(msgs[0].text).toBe('Original Content');
    });

    it('should clear history', () => {
        useSovereignStore.getState().addMessage({
            senderId: 'sys_xyz',
            senderName: 'System',
            text: 'Temporary Msg',
            scope: 'agent'
        });

        expect(useSovereignStore.getState().messages.length).toBe(1);

        useSovereignStore.getState().clearHistory();
        expect(useSovereignStore.getState().messages.length).toBe(0);
    });

    it('should update scope and detached states correctly', () => {
        useSovereignStore.getState().setScope('cluster');
        expect(useSovereignStore.getState().activeScope).toBe('cluster');

        useSovereignStore.getState().setDetached(true);
        expect(useSovereignStore.getState().isDetached).toBe(true);
    });
});
