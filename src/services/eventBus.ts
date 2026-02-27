/**
 * @module EventBus
 * Central pub/sub service that synchronizes the Terminal, Voice Comms,
 * and WebSocket log stream into a single unified event timeline.
 */

/** Origin of a log entry. */
type LogSource = 'User' | 'System' | 'Agent';

/** Visual severity used for color-coding in the Terminal UI. */
type LogSeverity = 'info' | 'success' | 'warning' | 'error';

/** A single event in the unified command timeline. */
export interface LogEntry {
    /** Unique identifier (auto-generated). */
    id: string;
    /** When the event occurred (auto-generated). */
    timestamp: Date;
    /** Who produced this entry. */
    source: LogSource;
    /** Human-readable message content. */
    text: string;
    /** Severity level for UI color-coding. */
    severity: LogSeverity;
    /** The originating agent's ID, if `source` is `'Agent'`. */
    agentId?: string;
}

type Listener = (entry: LogEntry) => void;

/**
 * Lightweight pub/sub event bus.
 * Components subscribe to receive {@link LogEntry} objects in real time.
 * History uses a true circular buffer (no array reallocation).
 */
class EventBusService {
    private listeners: Listener[] = [];

    /** Circular buffer for history — avoids array reallocation on overflow. */
    private static readonly BUFFER_SIZE = 1000;
    private ring: (LogEntry | null)[] = new Array(EventBusService.BUFFER_SIZE).fill(null);
    private head = 0;   // write pointer
    private count = 0;  // number of entries currently stored

    /** Subscribe to all future events. Returns an unsubscribe function. */
    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /** Emit an event to all subscribers. `id` and `timestamp` are auto-filled. */
    emit(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
        const fullEntry: LogEntry = {
            ...entry,
            id: crypto.randomUUID(),
            timestamp: new Date(),
        };

        // Write to circular buffer (O(1), no allocation)
        this.ring[this.head] = fullEntry;
        this.head = (this.head + 1) % EventBusService.BUFFER_SIZE;
        if (this.count < EventBusService.BUFFER_SIZE) this.count++;

        this.listeners.forEach(listener => {
            try {
                listener(fullEntry);
            } catch (error) {
                console.error('[EventBus] Error in listener:', error);
            }
        });
    }

    /** Returns a chronologically ordered copy of all stored history. */
    getHistory(): LogEntry[] {
        if (this.count === 0) return [];
        const result: LogEntry[] = [];
        const start = this.count < EventBusService.BUFFER_SIZE
            ? 0
            : this.head; // oldest entry is at head when buffer is full
        for (let i = 0; i < this.count; i++) {
            const idx = (start + i) % EventBusService.BUFFER_SIZE;
            if (this.ring[idx]) result.push(this.ring[idx]!);
        }
        return result;
    }

    /** Clears event history but keeps all subscribers intact. Safe for `/clear`. */
    clearHistory() {
        this.ring = new Array(EventBusService.BUFFER_SIZE).fill(null);
        this.head = 0;
        this.count = 0;
    }

    /** Full teardown: clears history AND removes all subscribers. Use on unmount. */
    destroy() {
        this.clearHistory();
        this.listeners = [];
    }
}

/** Singleton instance shared across the entire application. */
export const EventBus = new EventBusService();
