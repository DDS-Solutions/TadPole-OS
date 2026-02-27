import React, { useState, useEffect } from 'react';
import { Save, Server, Monitor, Cpu, Shield } from 'lucide-react';
import { getSettings, saveSettings, invalidateCache } from '../services/settingsStore';

export default function Settings() {
    // Local state for settings form
    const [settings, setSettings] = useState({
        openClawUrl: 'http://localhost:8000',
        openClawApiKey: '',
        theme: 'zinc',
        density: 'compact',
        defaultModel: 'GPT-4o',
        defaultTemperature: 0.7,
        autoApproveSafeSkills: true
    });

    const [isSaved, setIsSaved] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Load from centralized settings store on mount
    useEffect(() => {
        invalidateCache(); // Force fresh read
        const stored = getSettings();
        setSettings(stored);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

        setSettings({
            ...settings,
            [name]: val
        });
        setIsSaved(false);
        setValidationError(null);
    };

    const handleSave = async () => {
        const error = saveSettings(settings);
        if (error) {
            setValidationError(error);
            return;
        }

        // Synchronize governance settings with the backend
        try {
            await fetch(`${settings.openClawUrl}/oversight/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoApproveSafeSkills: settings.autoApproveSafeSkills })
            });
        } catch (e) {
            console.error("Failed to sync governance settings with engine", e);
            // We don't block the UI save if the backend is down, 
            // but we log it for debugging.
        }

        // Apply appearance engine preferences immediately
        document.documentElement.setAttribute('data-theme', settings.theme);
        document.documentElement.setAttribute('data-density', settings.density);

        setIsSaved(true);
        setValidationError(null);
        setTimeout(() => setIsSaved(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 h-full overflow-y-auto custom-scrollbar relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40 pt-2 mb-8">
                <div>
                    <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-tight">
                        <Server className="text-blue-500" />
                        System Configuration
                    </h1>
                    <p className="text-xs text-zinc-500 font-mono mt-1">GLOBAL PREFERENCES • ENGINE V2.4</p>
                </div>
                <button
                    onClick={handleSave}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isSaved ? 'bg-emerald-500 text-white' : validationError ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-900 hover:bg-white'}`}
                >
                    <Save size={16} />
                    {isSaved ? 'Saved!' : validationError ? 'Fix Errors' : 'Save Changes'}
                </button>
            </div>

            {/* Connection Settings */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Neural Engine Gateway
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-900 py-8 pl-8 pr-32 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Server size={80} />
                    </div>

                    <div className="space-y-3 z-10 relative">
                        <label htmlFor="openClawUrl" className="text-sm font-bold text-zinc-300 block">Engine API URL</label>
                        <input
                            id="openClawUrl"
                            type="text"
                            name="openClawUrl"
                            value={settings.openClawUrl}
                            onChange={handleChange}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono shadow-inner"
                            placeholder="http://localhost:8000"
                        />
                        <p className="text-xs text-zinc-500 leading-relaxed">The accessible URL of your local Tadpole Engine process.</p>
                        {validationError && (
                            <p className="text-xs text-red-400 font-medium mt-1">{validationError}</p>
                        )}
                    </div>
                    <div className="space-y-3 z-10 relative">
                        <label htmlFor="openClawApiKey" className="text-sm font-bold text-zinc-300 block">Neural Token (Vault Key)</label>
                        <input
                            id="openClawApiKey"
                            type="password"
                            name="openClawApiKey"
                            value={settings.openClawApiKey}
                            onChange={handleChange}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono shadow-inner"
                            placeholder="Enter your NEURAL_TOKEN..."

                        />
                        <p className="text-xs text-zinc-500 leading-relaxed">Leave empty to use the default development token.</p>
                    </div>
                </div>
            </div>

            {/* Appearance Settings */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Appearance
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-900 py-8 pl-8 pr-32 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Monitor size={80} />
                    </div>

                    <div className="space-y-3 z-10 relative">
                        <label htmlFor="theme" className="text-sm font-bold text-zinc-300 block">Theme Base</label>
                        <select
                            id="theme"
                            name="theme"
                            value={settings.theme}
                            onChange={handleChange}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer shadow-sm"
                        >
                            <option value="zinc">Zinc (Default)</option>
                            <option value="slate">Slate</option>
                            <option value="neutral">Neutral</option>
                        </select>
                    </div>
                    <div className="space-y-3 z-10 relative">
                        <label htmlFor="density" className="text-sm font-bold text-zinc-300 block">Information Density</label>
                        <select
                            id="density"
                            name="density"
                            value={settings.density}
                            onChange={handleChange}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer shadow-sm"
                        >
                            <option value="compact">Compact (High Performance)</option>
                            <option value="comfortable">Comfortable (Standard)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Agent Defaults */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Agent Defaults
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-900 py-8 pl-8 pr-32 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Cpu size={80} />
                    </div>

                    <div className="space-y-3 z-10 relative">
                        <label htmlFor="defaultModel" className="text-sm font-bold text-zinc-300 block">Default Intelligence Model</label>
                        <select
                            id="defaultModel"
                            name="defaultModel"
                            value={settings.defaultModel}
                            onChange={handleChange}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer font-mono shadow-sm"
                        >
                            <option value="GPT-4o">GPT-4o (Standard)</option>
                            <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                            <option value="DeepSeek V3">DeepSeek V3</option>
                            <option value="o1-preview">o1-preview (Deep Reasoning)</option>
                        </select>
                        <p className="text-xs text-zinc-500 leading-relaxed">The baseline model assigned to new agents or unconfigured nodes.</p>
                    </div>

                    <div className="space-y-3 z-10 relative">
                        <div className="flex justify-between items-center">
                            <label htmlFor="defaultTemperature" className="text-sm font-bold text-zinc-300 block">Default Temperature</label>
                            <span className="text-xs font-mono text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">{settings.defaultTemperature}</span>
                        </div>
                        <input
                            id="defaultTemperature"
                            type="range"
                            name="defaultTemperature"
                            min="0"
                            max="2"
                            step="0.1"
                            value={settings.defaultTemperature}
                            onChange={handleChange}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2 hover:bg-zinc-700 transition-colors"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">
                            <span>Precise</span>
                            <span>Balanced</span>
                            <span>Creative</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Governance & Oversight */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Governance & Oversight
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-900 py-8 pl-8 pr-32 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Shield size={80} />
                    </div>

                    <div className="space-y-3 z-10 relative">
                        <div className="flex items-center justify-between">
                            <label htmlFor="autoApproveSafeSkills" className="text-sm font-bold text-zinc-300">Auto-Approve Safe Skills</label>
                            <input
                                id="autoApproveSafeSkills"
                                type="checkbox"
                                name="autoApproveSafeSkills"
                                checked={settings.autoApproveSafeSkills}
                                onChange={handleChange}
                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                            />
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            When enabled, low-risk skills like <span className="text-blue-400 font-medium">weather</span> and <span className="text-blue-400 font-medium">reasoning</span> will execute automatically without manual user approval.
                        </p>
                    </div>

                    <div className="space-y-3 z-10 flex flex-col justify-center relative">
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-400/90 italic leading-relaxed">
                                "Autonomous execution of Safe Skills preserves mission momentum while maintaining human governance over high-risk operations."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
