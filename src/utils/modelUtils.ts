/**
 * @module modelUtils
 * Utility for mapping friendly display names to technical model IDs.
 */

const MODEL_MAP: Record<string, string> = {
    // Groq
    "Llama 3.3 70B (Groq)": "llama-3.3-70b-versatile",
    "Mixtral 8x7B (Groq)": "mixtral-8x7b-32768",

    // Google (Tadpole OS matches technically anyway, but for safety)
    "Gemini 1.5 Pro": "gemini-1.5-pro",
    "Gemini 1.5 Flash": "gemini-1.5-flash",
    "Gemini 3 Pro": "gemini-3.0-pro-preview",
    "Gemini 3 Flash": "gemini-3.0-flash-preview",

    // OpenAI
    "GPT-5.2": "gpt-5.2-preview",
    "GPT-4.1": "gpt-4.1-turbo",
    "o4-mini": "o4-mini-2026-02",

    // Anthropic
    "Claude Opus 4.5": "claude-4.5-opus",
    "Claude Sonnet 4.5": "claude-4.5-sonnet",
};

/**
 * Resolves a friendly model name into its technical ID.
 * Returns the original name if no mapping is found.
 */
export function resolveTechnicalModelId(modelName: string): string {
    return MODEL_MAP[modelName] || modelName;
}

/**
 * Returns a Tailwind color class based on the model or provider.
 */
export function getModelColor(modelName: string): string {
    const lower = modelName.toLowerCase();

    // OpenAI - Emerald/Green
    if (lower.includes('gpt') || lower.includes('o4')) return 'text-emerald-400 border-emerald-900 bg-emerald-900/10';

    // Anthropic - Purple/Indigo
    if (lower.includes('claude')) return 'text-purple-400 border-purple-900 bg-purple-900/10';

    // Google - Blue/Sky
    if (lower.includes('gemini')) return 'text-blue-400 border-blue-900 bg-blue-900/10';

    // Groq - Amber/Orange
    if (lower.includes('groq') || lower.includes('llama')) return 'text-amber-400 border-amber-900 bg-amber-900/10';

    // DeepSeek - Cyan/Teal
    if (lower.includes('deepseek')) return 'text-cyan-400 border-cyan-900 bg-cyan-900/10';

    // xAI / Grok - Zinc/White
    if (lower.includes('grok')) return 'text-zinc-100 border-zinc-700 bg-zinc-800/50';

    return 'text-zinc-400 border-zinc-800 bg-zinc-900';
}
