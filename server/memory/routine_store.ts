/**
 * @module server/memory/routine_store
 * @description Persistent store for "Routines" - successful tool execution sequences.
 * This enables procedural memory for agents to learn from past successes.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Represents a successful sequence of tool calls that achieved a goal.
 */
export interface Routine {
    id: string;
    /** The high-level intent or goal of this sequence. */
    intent: string;
    /** The department where this routine was established. */
    department: string;
    /** The sequence of tools called. */
    steps: {
        skill: string;
        params: any;
        result: any;
    }[];
    /** Success metadata. */
    outcome: string;
    /** Usage count for ranking. */
    hits: number;
    /** Metadata. */
    createdAt: string;
}

export class RoutineStore {
    private filePath: string;
    private routines: Routine[] = [];

    constructor() {
        this.filePath = path.resolve(process.cwd(), 'data', 'routines.json');
        this.ensureStoreExists();
    }

    private async ensureStoreExists() {
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });

            try {
                const data = await fs.readFile(this.filePath, 'utf-8');
                this.routines = JSON.parse(data);
            } catch (e) {
                // Initialize with empty array if file doesn't exist or is invalid
                this.routines = [];
                await this.save();
            }
        } catch (error) {
            console.error('❌ Failed to initialize RoutineStore:', error);
        }
    }

    private async save() {
        await fs.writeFile(this.filePath, JSON.stringify(this.routines, null, 2));
    }

    /**
     * Records a new routine or updates an existing one if the intent matches.
     */
    public async record(routine: Omit<Routine, 'id' | 'hits' | 'createdAt'>): Promise<string> {
        const id = `RT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const newRoutine: Routine = {
            ...routine,
            id,
            hits: 1,
            createdAt: new Date().toISOString()
        };

        this.routines.push(newRoutine);
        await this.save();
        return id;
    }

    /**
     * Searches for routines matching an intent via simple keyword overlap.
     * In a full implementation, this would use vector embeddings.
     */
    public async recall(intent: string, department?: string): Promise<Routine[]> {
        const keywords = intent.toLowerCase().split(/\s+/);

        return this.routines
            .filter(r => {
                if (department && r.department !== department) return false;
                const routineIntent = r.intent.toLowerCase();
                return keywords.some(k => routineIntent.includes(k));
            })
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 5);
    }

    /**
     * Clears all routines (Internal use for testing).
     */
    public async clear(): Promise<void> {
        this.routines = [];
        await this.save();
    }
}

// Export singleton
export const routineStore = new RoutineStore();
