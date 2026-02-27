import { useState, useEffect } from 'react';
import { openClawSocket, type ConnectionState } from '../services/openclawSocket';

export interface EngineHealth {
    uptime: number;
    agents: number;
    cpu: number;
    memoryMB: number;
    latencyMs: number;
}

/**
 * Custom hook to monitor the real-time status of the Tadpole Engine.
 * Subscribes to high-frequency "Neural Pulse" telemetry (100ms) for CPU,
 * Memory, and Latency diagnostics.
 */
export function useEngineStatus() {
    const [connectionState, setConnectionState] = useState<ConnectionState>(openClawSocket.getConnectionState());
    const [health, setHealth] = useState<EngineHealth | null>(null);

    useEffect(() => {
        // Ensure connected
        openClawSocket.connect();

        let lastUpdate = 0;
        const THROTTLE_MS = 500;

        const unsubscribeStatus = openClawSocket.subscribeStatus((state) => {
            setConnectionState(state);
            if (state !== 'connected') setHealth(null);
        });

        const unsubscribeHealth = openClawSocket.subscribeHealth((data) => {
            const now = Date.now();
            if (now - lastUpdate < THROTTLE_MS) return;
            lastUpdate = now;

            setHealth(_prev => {
                if (!data) return _prev;
                // Return a full EngineHealth object to satisfy the non-optional types
                // Normalize agentCount vs agents from the backend broadcast
                const agentsVal = typeof data.agentCount === 'number' ? data.agentCount :
                    (typeof data.agents === 'number' ? data.agents : (_prev?.agents ?? 0));

                return {
                    uptime: typeof data.uptime === 'number' ? data.uptime : (_prev?.uptime ?? 0),
                    agents: agentsVal,
                    cpu: typeof data.cpu === 'number' ? data.cpu : (_prev?.cpu ?? 0),
                    memoryMB: typeof data.memoryMB === 'number' ? data.memoryMB : (_prev?.memoryMB ?? 0),
                    latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : (_prev?.latencyMs ?? 0)
                };
            });
        });

        return () => {
            unsubscribeStatus();
            unsubscribeHealth();
        };
    }, []);

    return {
        connectionState,
        isOnline: connectionState === 'connected',
        isConnecting: connectionState === 'connecting',
        uptime: health?.uptime ?? 0,
        agentsCount: health?.agents ?? 0,
        cpu: health?.cpu ?? 0,
        memory: (health?.memoryMB ?? 0) / 1024,
        latency: health?.latencyMs ?? 0
    };
}
