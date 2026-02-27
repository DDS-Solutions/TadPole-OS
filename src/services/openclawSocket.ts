/**
 * @module OpenClawSocket
 * Manages a persistent WebSocket connection to the OpenClaw backend.
 * Incoming log/thought events are normalized and forwarded to the
 * shared {@link EventBus}, making them visible in the Terminal and Voice Comms.
 *
 * Handles automatic reconnection with exponential backoff.
 */
import { EventBus } from './eventBus';
import { getSettings } from './settingsStore';

/** Payload for agent update/status events from the WebSocket. */
export interface AgentUpdateEvent {
    type: 'agent:update' | 'agent:status';
    agentId?: string;
    status?: string;
    data?: Record<string, unknown>;
}

/** Payload for engine health broadcast events. */
export interface EngineHealthEvent {
    type: 'engine:health';
    uptime?: number;
    agentCount?: number;
    activeMissions?: number;
    [key: string]: unknown;
}

/** Payload for inter-cluster handoff events. */
export interface HandoffEvent {
    type: 'agent:handoff';
    fromCluster?: string;
    toCluster?: string;
    agentId?: string;
    payload?: Record<string, unknown>;
}

/** Maximum number of reconnect attempts before giving up. */
const MAX_RETRIES = 10;
/** Initial backoff delay in ms. */
const INITIAL_BACKOFF = 2000;
/** Maximum backoff delay in ms. */
const MAX_BACKOFF = 30000;

/** Connection states for the socket. */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

type StateListener = (state: ConnectionState) => void;

/**
 * WebSocket client for streaming real-time logs from OpenClaw.
 * Reads the connection URL from the centralized settings store.
 * Falls back to `ws://localhost:8000` if unconfigured.
 */
export class OpenClawSocket {
    private socket: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isExplicitlyClosed = false;
    private retryCount = 0;

    // State Management
    private state: ConnectionState = 'disconnected';
    private stateListeners: StateListener[] = [];

    /** Subscribe to connection state changes. */
    subscribeStatus(listener: StateListener): () => void {
        this.stateListeners.push(listener);
        listener(this.state); // Immediate update
        return () => {
            this.stateListeners = this.stateListeners.filter(l => l !== listener);
        };
    }

    private setState(newState: ConnectionState) {
        if (this.state !== newState) {
            this.state = newState;
            this.stateListeners.forEach(l => l(newState));
        }
    }

    // Agent Update Management
    private agentUpdateListeners: ((update: AgentUpdateEvent) => void)[] = [];

    subscribeAgentUpdates(listener: (update: AgentUpdateEvent) => void): () => void {
        this.agentUpdateListeners.push(listener);
        return () => {
            this.agentUpdateListeners = this.agentUpdateListeners.filter(l => l !== listener);
        };
    }

    // Health Management
    private healthListeners: ((health: EngineHealthEvent) => void)[] = [];

    subscribeHealth(listener: (health: EngineHealthEvent) => void): () => void {
        this.healthListeners.push(listener);
        return () => {
            this.healthListeners = this.healthListeners.filter(l => l !== listener);
        };
    }

    // Handoff Management
    private handoffListeners: ((handoff: HandoffEvent) => void)[] = [];

    subscribeHandoff(listener: (handoff: HandoffEvent) => void): () => void {
        this.handoffListeners.push(listener);
        return () => {
            this.handoffListeners = this.handoffListeners.filter(l => l !== listener);
        };
    }

    getConnectionState(): ConnectionState {
        return this.state;
    }

    /** Opens the WebSocket connection and begins listening for events. */
    connect() {
        // Guard: Don't connect if already connecting or connected
        if (this.socket || this.reconnectTimer || this.state === 'connected') {
            console.log('[OpenClaw] Connection already active or in progress. Skipping.');
            return;
        }

        this.isExplicitlyClosed = false;
        this.setState('connecting');

        // Get URL from centralized settings, converting http/https to ws/wss
        const { openClawUrl, openClawApiKey } = getSettings();
        // Remove trailing slash if present, then replace http with ws
        const baseUrl = openClawUrl.trim().replace(/\/$/, '').replace(/^http/, 'ws');
        // Centralized token retrieval from SettingsStore
        const token = openClawApiKey || 'tadpole-dev-token-2026';
        const wsUrl = `${baseUrl}/engine/ws?token=${token}`;

        console.log(`[OpenClaw] Connecting to log stream at ${wsUrl}... (attempt ${this.retryCount + 1})`);

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('[OpenClaw] Connected to log stream.');
                this.retryCount = 0; // Reset on successful connection
                this.setState('connected');

                EventBus.emit({
                    source: 'System',
                    text: 'Connected to OpenClaw Log Stream.',
                    severity: 'success'
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'log' || data.type === 'thought') {
                        EventBus.emit({
                            source: data.agentId ? 'Agent' : 'System',
                            agentId: data.agentId,
                            text: data.message || JSON.stringify(data),
                            severity: (data.level === 'error' ? 'error' : 'info')
                        });
                    } else if (data.type === 'agent:message') {
                        // Bridge final mission results to the log stream
                        EventBus.emit({
                            source: 'Agent',
                            agentId: data.agentId,
                            text: data.text || 'Mission action complete.',
                            severity: 'info'
                        });
                        // Bridge to SovereignChat
                        import('./sovereignStore').then(({ useSovereignStore }) => {
                            import('./agentStore').then(({ useAgentStore }) => {
                                const store = useSovereignStore.getState();
                                const agentStore = useAgentStore.getState();
                                const agent = agentStore.agents.find(a => a.id === data.agentId);

                                // Fallback mapping for dynamically spawned sub-agents
                                let resolvedName = agent?.name || data.agentName;
                                if (!resolvedName) {
                                    if (data.agentId === '3') resolvedName = 'Elon';
                                    else if (data.agentId === '2') resolvedName = 'Alpha';
                                    else resolvedName = data.agentId || 'Agent';
                                }

                                store.addMessage({
                                    id: data.messageId,
                                    senderId: data.agentId || 'system',
                                    senderName: resolvedName,
                                    targetNode: resolvedName, // Chat UI filters by this string!
                                    text: data.text || data.message || 'Mission action complete.',
                                    scope: store.activeScope
                                });
                            });
                        });
                    } else if (data.type === 'agent:update' || data.type === 'agent:status') {
                        // Forward both update and status events to visual listeners (Agent Cards)
                        const normalizedData = data.type === 'agent:status'
                            ? { ...data, type: 'agent:update', data: { status: data.status } }
                            : data;
                        this.agentUpdateListeners.forEach(l => l(normalizedData));

                        // Also bridge status changes to System Log for operational feedback
                        if (data.type === 'agent:status' && data.agentId) {
                            const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
                            EventBus.emit({
                                source: 'System',
                                agentId: data.agentId,
                                text: `Agent ${data.agentId} is now ${statusLabel}.`,
                                severity: 'info'
                            });
                        }
                    } else if (data.type === 'engine:health') {
                        this.healthListeners.forEach(l => l(data));
                    } else if (data.type === 'agent:handoff') {
                        this.handoffListeners.forEach(l => l(data));
                    }
                } catch {
                    EventBus.emit({
                        source: 'System',
                        text: `[Raw]: ${event.data}`,
                        severity: 'info'
                    });
                }
            };

            this.socket.onclose = () => {
                this.socket = null; // Clear reference
                this.setState('disconnected');
                if (!this.isExplicitlyClosed) {
                    this.scheduleReconnect();
                }
            };

            this.socket.onerror = (err) => {
                console.error('[OpenClaw] Socket error:', err);
                this.setState('disconnected');
                this.socket?.close();
            };

        } catch (error) {
            console.error('[OpenClaw] Connection failed:', error);
            this.setState('disconnected');
            this.scheduleReconnect();
        }
    }

    /**
     * Schedules a reconnection attempt with exponential backoff.
     * Gives up after MAX_RETRIES and emits a warning.
     */
    private scheduleReconnect() {
        if (this.retryCount >= MAX_RETRIES) {
            EventBus.emit({
                source: 'System',
                text: `OpenClaw: Connection failed after ${MAX_RETRIES} attempts. Use Settings to verify the URL, then reload.`,
                severity: 'error'
            });
            return;
        }

        const delay = Math.min(INITIAL_BACKOFF * Math.pow(2, this.retryCount), MAX_BACKOFF);
        this.retryCount++;

        this.setState('connecting');
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null; // Clear reference before re-entering connect()
            this.connect();
        }, delay);
    }

    /** Cleanly closes the connection and prevents auto-reconnect. */
    disconnect() {
        this.isExplicitlyClosed = true;
        this.retryCount = 0;
        this.setState('disconnected');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close();
    }
}

/** Singleton instance shared across the application. */
export const openClawSocket = new OpenClawSocket();
