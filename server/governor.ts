/**
 * @module server/governor
 * The Governor service manages global and per-model rate limits (TPM/RPM).
 * It ensures that AI agents do not exceed provider-imposed constraints.
 */

import type { ModelConfig, TokenUsage } from './types.js';

/** Stats returned by the Governor, mapping model IDs to wait times (ms). */
export type GovernorStats = Record<string, number>;

interface ModelBucket {
    requests: number[]; // timestamps of requests in the last minute
    tokens: { timestamp: number; count: number }[]; // history of token usage
    dailyRequests: number;
    dailyTokens: number;
    lastDayReset: number;
}

export class Governor {
    private buckets: Map<string, ModelBucket> = new Map();
    private throttleStats: Map<string, number> = new Map();
    private modelPenalties: Map<string, number> = new Map(); // timestamp until penalty expires

    constructor() {
        console.log('🏛️  [Governor] Service Activated. Neural Pulse monitoring active.');
    }

    /**
     * Records a rate limit error (429/413) and applies a penalty wait.
     */
    public recordBackoff(modelId: string, retryAfterSeconds: number = 30) {
        const penaltyUntil = Date.now() + (retryAfterSeconds * 1000);
        this.modelPenalties.set(modelId, penaltyUntil);
        console.warn(`🛑 Governor: Backoff recorded for ${modelId}. Penalty active for ${retryAfterSeconds}s.`);
    }

    /**
     * Returns current throttle wait times for all active models.
     */
    public getStats(): GovernorStats {
        const stats: GovernorStats = Object.fromEntries(this.throttleStats);
        // Tag models under penalty
        for (const [modelId, until] of this.modelPenalties) {
            if (until > Date.now()) {
                stats[`${modelId}:penalty`] = until - Date.now();
            }
        }
        return stats;
    }

    /**
     * Throttles an incoming request based on its model configuration.
     * Blocks until it is safe to proceed.
     */
    public async throttle(config: ModelConfig): Promise<void> {
        const modelId = config.modelId;
        const now = Date.now();

        // 1. Check Model Penalty
        const penaltyUntil = this.modelPenalties.get(modelId);
        if (penaltyUntil && penaltyUntil > now) {
            const waitTime = penaltyUntil - now;
            console.log(`⏳ Governor: Model ${modelId} is under penalty. Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // 2. Resolve Model Bucket
        let bucket = this.buckets.get(modelId);
        if (!bucket) {
            bucket = {
                requests: [],
                tokens: [],
                dailyRequests: 0,
                dailyTokens: 0,
                lastDayReset: now
            };
            this.buckets.set(modelId, bucket);
        }

        // 3. Reset Daily if needed (24h)
        if (now - bucket.lastDayReset > 24 * 60 * 60 * 1000) {
            bucket.dailyRequests = 0;
            bucket.dailyTokens = 0;
            bucket.lastDayReset = now;
        }

        // 4. Enforce Limits & Record Wait Time
        const startTime = Date.now();
        await this.checkAndWait(config, bucket);
        const waitTime = Date.now() - startTime;

        // Update stats
        this.throttleStats.set(modelId, waitTime);

        // 5. Commit Request (Start)
        bucket.requests.push(Date.now());
        bucket.dailyRequests++;
    }

    /**
     * Records actual token usage after a successful generation.
     */
    public recordUsage(modelId: string, usage: TokenUsage | { totalTokens: number }) {
        const bucket = this.buckets.get(modelId);
        if (!bucket) return;

        const totalTokens = 'totalTokens' in usage ? usage.totalTokens : 0;
        bucket.tokens.push({ timestamp: Date.now(), count: totalTokens });
        bucket.dailyTokens += totalTokens;
    }

    /** Maximum retry iterations for checkAndWait before hard-failing. */
    private static readonly MAX_THROTTLE_RETRIES = 10;

    private async checkAndWait(config: ModelConfig, bucket: ModelBucket): Promise<void> {
        for (let attempt = 0; attempt < Governor.MAX_THROTTLE_RETRIES; attempt++) {
            const now = Date.now();
            const oneMinute = 60 * 1000;

            // Clean up old history
            bucket.requests = bucket.requests.filter(t => now - t < oneMinute);
            bucket.tokens = bucket.tokens.filter(t => now - t.timestamp < oneMinute);

            // Check RPM
            if (config.rpm && bucket.requests.length >= config.rpm) {
                const oldest = bucket.requests[0];
                const waitTime = oneMinute - (now - oldest);
                console.log(`⚠️  Governor: RPM Limit Reached for ${config.modelId} (attempt ${attempt + 1}/${Governor.MAX_THROTTLE_RETRIES}). Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Re-check after waiting
            }

            // Check TPM (Estimate)
            const currentTpm = bucket.tokens.reduce((sum, t) => sum + t.count, 0);
            if (config.tpm && currentTpm >= config.tpm) {
                const oldest = bucket.tokens[0] ? bucket.tokens[0].timestamp : now;
                const waitTime = oneMinute - (now - oldest);
                console.log(`⚠️  Governor: TPM Limit Reached for ${config.modelId} (attempt ${attempt + 1}/${Governor.MAX_THROTTLE_RETRIES}). Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // Check Daily Limits (Hard Stop)
            if (config.rpd && bucket.dailyRequests >= config.rpd) {
                throw new Error(`🛑 Governor: Daily Request Limit (${config.rpd}) exceeded for model ${config.modelId}.`);
            }
            if (config.tpd && bucket.dailyTokens >= config.tpd) {
                throw new Error(`🛑 Governor: Daily Token Limit (${config.tpd}) exceeded for model ${config.modelId}.`);
            }

            // All checks passed
            return;
        }

        throw new Error(`🛑 Governor: Throttle retry limit (${Governor.MAX_THROTTLE_RETRIES}) exceeded for model ${config.modelId}. Aborting to prevent infinite wait.`);
    }
}

export const globalGovernor = new Governor();
