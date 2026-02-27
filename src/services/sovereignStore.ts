import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SovereignScope = 'agent' | 'cluster' | 'swarm';

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: string;
    scope: SovereignScope;
    agentId?: string;
    isSubAgent?: boolean;
    lineage?: string[];
    targetNode?: string;
}

interface SovereignState {
    messages: ChatMessage[];
    activeScope: SovereignScope;
    selectedAgentId: string | null;
    targetAgent: string;
    targetCluster: string;
    isDetached: boolean;

    // Actions
    addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string, timestamp?: string }) => void;
    setScope: (scope: SovereignScope) => void;
    setSelectedAgentId: (agentId: string | null) => void;
    setTargetAgent: (name: string) => void;
    setTargetCluster: (name: string) => void;
    setDetached: (detached: boolean) => void;
    clearHistory: () => void;
}

// Cross-window synchronization
const chatChannel = typeof window !== 'undefined' ? new BroadcastChannel('tadpole-chat-sync') : null;

export const useSovereignStore = create<SovereignState>()(
    persist(
        (set) => ({
            messages: [],
            activeScope: 'agent',
            selectedAgentId: null,
            targetAgent: 'CEO',
            targetCluster: '',
            isDetached: false,

            addMessage: (msg) => {
                const newMsg = {
                    ...msg,
                    id: msg.id || crypto.randomUUID(),
                    timestamp: msg.timestamp || new Date().toISOString(),
                };
                set((state) => {
                    if (state.messages.some(m => m.id === newMsg.id)) {
                        return state; // Deduplicate
                    }
                    return {
                        messages: [...state.messages, newMsg]
                    };
                });
                // Sync to other windows
                chatChannel?.postMessage({ type: 'ADD_MESSAGE', payload: newMsg });
            },

            setScope: (activeScope) => {
                set({ activeScope });
                chatChannel?.postMessage({ type: 'SET_SCOPE', payload: activeScope });
            },

            setSelectedAgentId: (selectedAgentId) => {
                set({ selectedAgentId });
                chatChannel?.postMessage({ type: 'SET_AGENT', payload: selectedAgentId });
            },

            setTargetAgent: (targetAgent) => {
                set({ targetAgent });
                chatChannel?.postMessage({ type: 'SET_TARGET_AGENT', payload: targetAgent });
            },

            setTargetCluster: (targetCluster) => {
                set({ targetCluster });
                chatChannel?.postMessage({ type: 'SET_TARGET_CLUSTER', payload: targetCluster });
            },

            setDetached: (isDetached) => set({ isDetached }),

            clearHistory: () => {
                set({ messages: [] });
                chatChannel?.postMessage({ type: 'CLEAR_HISTORY' });
            },
        }),
        {
            name: 'tadpole-sovereign-chat',
        }
    )
);

// Listen for sync events
if (chatChannel) {
    chatChannel.onmessage = (event) => {
        const { type, payload } = event.data;
        const state = useSovereignStore.getState();

        switch (type) {
            case 'ADD_MESSAGE':
                if (!state.messages.find(m => m.id === payload.id)) {
                    useSovereignStore.setState({
                        messages: [...state.messages, payload]
                    });
                }
                break;
            case 'SET_SCOPE':
                useSovereignStore.setState({ activeScope: payload });
                break;
            case 'SET_AGENT':
                useSovereignStore.setState({ selectedAgentId: payload });
                break;
            case 'SET_TARGET_AGENT':
                useSovereignStore.setState({ targetAgent: payload });
                break;
            case 'SET_TARGET_CLUSTER':
                useSovereignStore.setState({ targetCluster: payload });
                break;
            case 'CLEAR_HISTORY':
                useSovereignStore.setState({ messages: [] });
                break;
        }
    };
}
