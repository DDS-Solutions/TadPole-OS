/**
 * @module engine/oversight
 * The Oversight Gate — every agent tool call passes through here.
 * Manual approval required for all actions (no auto-approve for now).
 */

import { randomUUID } from 'node:crypto';
import type {
    OversightEntry,
    LedgerEntry,
    ToolCall,
    ToolResult,
    EngineEvent,
} from './types.js';

type BroadcastFn = (event: EngineEvent) => void;

export class OversightGate {
    /** Pending actions awaiting user approval. */
    private queue: Map<string, OversightEntry> = new Map();

    /** Immutable action log. */
    private ledger: LedgerEntry[] = [];

    /** Global kill switch state. */
    private killed = false;

    /** Callback to broadcast events to connected WebSocket clients. */
    private broadcast: BroadcastFn;

    /** Shared skills that bypass oversight for all departments. */
    private globalSafeSkills: Set<string> = new Set(['reasoning', 'weather']);

    /** Department-specific skills that bypass oversight. */
    private departmentalSafeSkills: Record<string, Set<string>> = {
        'Engineering': new Set(['fetch', 'fs']), // Engineers can read/write and fetch without asking
        'Operations': new Set(['fetch', 'shell']), // Operations can run whitelisted shell commands
        'Quality Assurance': new Set(['fetch', 'reasoning']),
    };

    /** Whether auto-approval is enabled. */
    private autoApprove = true;

    /** Resolvers for pending approval promises. */
    private resolvers: Map<string, (approved: boolean) => void> = new Map();

    constructor(broadcast: BroadcastFn) {
        this.broadcast = broadcast;

        // Seed initial ledger data for "System Initialization" visibility
        this.seedInitialData();
    }

    /** Updates governance settings. */
    setGovernance(settings: { autoApproveSafeSkills: boolean }): void {
        this.autoApprove = settings.autoApproveSafeSkills;
    }

    /** Seeds the ledger with system events. */
    private seedInitialData(): void {
        const initialActions: LedgerEntry[] = [
            {
                id: randomUUID(),
                toolCall: {
                    id: randomUUID(),
                    agentId: 'Nexus',
                    department: 'Engineering',
                    skill: 'Initialize Engine',
                    description: 'Tadpole Engine core services starting up...',
                    params: { version: '1.4.2', secure_mode: true },
                    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                },
                decision: 'approved',
                result: { success: true, output: { status: 'Core ready.' }, durationMs: 450 },
                timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            },
            {
                id: randomUUID(),
                toolCall: {
                    id: randomUUID(),
                    agentId: 'Nexus',
                    department: 'Engineering',
                    skill: 'Neural Link',
                    description: 'Establishing WebSocket handshake with strategic swarm...',
                    params: { protocol: 'ws', port: 8000 },
                    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
                },
                decision: 'approved',
                result: { success: true, output: { clients: 0 }, durationMs: 120 },
                timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
            }
        ];

        this.ledger.push(...initialActions);
    }

    // ─── Kill Switch ───────────────────────────────────────────

    kill(reason: string): void {
        this.killed = true;
        console.log(`[Oversight] Kill switch activated: ${reason}`);

        // Reject all pending entries and clear resolvers
        for (const [id, resolve] of this.resolvers) {
            console.log(`[Oversight] Rejecting pending task ${id}`);
            resolve(false); // Reject the action
        }

        // Clear all queues
        this.queue.clear();
        this.resolvers.clear();

        this.broadcast({ type: 'engine:killed', reason });
    }

    /** Resets the kill switch, allowing new actions. */
    reset(): void {
        this.killed = false;
    }

    isKilled(): boolean {
        return this.killed;
    }

    // ─── Queue Management ──────────────────────────────────────

    /**
     * Submits a tool call for approval. Returns a promise that resolves
     * to `true` (approved) or `false` (rejected) when the user decides.
     */
    async submit(toolCall: ToolCall): Promise<boolean> {
        if (this.killed) {
            console.warn(`[Oversight] Rejected ${toolCall.skill} (Kill Switch Active)`);
            return false;
        }

        // --- Departmental Safety Policy Check ---
        if (this.autoApprove) {
            // 1. Global Safe Skills
            if (this.globalSafeSkills.has(toolCall.skill)) {
                return true;
            }

            // 2. Departmental Safe Skills
            const deptSafe = this.departmentalSafeSkills[toolCall.department];
            if (deptSafe && deptSafe.has(toolCall.skill)) {
                console.log(`✅ Auto-approving '${toolCall.skill}' for department '${toolCall.department}'`);
                return true;
            }
        }

        const entry: OversightEntry = {
            id: randomUUID(),
            toolCall,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        this.queue.set(entry.id, entry);
        this.broadcast({ type: 'oversight:new', entry });

        return new Promise<boolean>((resolve) => {
            this.resolvers.set(entry.id, resolve);
        });
    }

    /**
     * Records the user's decision on a pending oversight entry.
     * Returns the decided entry, or null if not found.
     */
    decide(entryId: string, decision: 'approved' | 'rejected'): OversightEntry | null {
        const entry = this.queue.get(entryId);
        if (!entry) return null;

        const decidedAt = new Date().toISOString();
        const decidedBy = 'user';

        // Update the entry status before returning/broadcasting
        entry.status = decision;

        this.queue.delete(entryId);
        this.broadcast({
            type: 'oversight:decided',
            entry: {
                id: entryId,
                decision,
                decidedBy,
                decidedAt
            }
        });

        // Resolve the promise the agent runner is awaiting
        const resolve = this.resolvers.get(entryId);
        if (resolve) {
            resolve(decision === 'approved');
            this.resolvers.delete(entryId);
        }

        return entry;
    }

    // ─── Ledger ────────────────────────────────────────────────

    /** Appends an action to the immutable ledger. */
    recordAction(toolCall: ToolCall, decision: 'approved' | 'rejected', result?: ToolResult): void {
        const entry: LedgerEntry = {
            id: randomUUID(),
            toolCall,
            decision,
            result,
            timestamp: new Date().toISOString(),
        };

        this.ledger.push(entry);

        // Bounded Ledger: Maintain max 1000 entries to prevent memory leaks
        if (this.ledger.length > 1000) {
            this.ledger.shift(); // Remove oldest
        }

        this.broadcast({ type: 'ledger:entry', entry });

        // IF this was a delegate_task and it was successful, broadcast a handoff event
        if (result && result.success && result.output && result.output.handoff) {
            const handoff = result.output.handoff;
            this.broadcast({
                type: 'agent:handoff',
                sourceClusterId: toolCall.clusterId || 'unknown',
                targetClusterId: handoff.targetClusterId,
                brief: handoff.brief
            });
        }
    }

    /**
     * Public proxy to broadcast raw engine events.
     * Used by AgentRunner for telemetry updates.
     */
    public emit(event: EngineEvent): void {
        this.broadcast(event);
    }

    /** Returns the full ledger (read-only). */
    getLedger(): readonly LedgerEntry[] {
        return this.ledger;
    }

    /** Returns all pending entries. */
    getPending(): OversightEntry[] {
        return Array.from(this.queue.values());
    }

    /** Returns counts for the dashboard. */
    getStats(): { pending: number; approved: number; rejected: number; total: number } {
        const approved = this.ledger.filter(e => e.decision === 'approved').length;
        const rejected = this.ledger.filter(e => e.decision === 'rejected').length;
        return {
            pending: this.queue.size,
            approved,
            rejected,
            total: this.ledger.length,
        };
    }
}
