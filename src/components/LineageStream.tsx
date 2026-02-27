import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronRight, Share2 } from 'lucide-react';
import { EventBus } from '../services/eventBus';
import { useSovereignStore } from '../services/sovereignStore';

interface LineageEvent {
    id: string;
    agentId: string;
    agentName: string;
    text: string;
    timestamp: string;
    lineage: string[];
}

/**
 * LineageStream
 * A real-time activity feed that filters for events based on the active swarm node.
 * Refined with high-tier glassmorphism and pulsing heartbeat aesthetics.
 */
export const LineageStream: React.FC = () => {
    const [events, setEvents] = useState<LineageEvent[]>([]);
    const { activeScope } = useSovereignStore();

    useEffect(() => {
        const unsubscribe = EventBus.subscribe((entry) => {
            if (entry.source === 'Agent') {
                const newEvent: LineageEvent = {
                    id: entry.id,
                    agentId: entry.agentId || 'unknown',
                    agentName: entry.agentId || 'Node',
                    text: entry.text,
                    timestamp: entry.timestamp.toISOString(),
                    lineage: []
                };

                setEvents(prev => [newEvent, ...prev].slice(0, 50));
            }
        });

        return () => unsubscribe();
    }, []);

    const filteredEvents = events.filter(_event => {
        if (activeScope === 'swarm') return true;
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-zinc-950/40 backdrop-blur-xl border-l border-zinc-900 w-72 hidden xl:flex relative overflow-hidden group">
            {/* Animated Vertical Border Pulse */}
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-zinc-800 transition-colors group-hover:bg-zinc-700" />
            <div className="vertical-pulse absolute left-0 top-0 bottom-0 w-[2px] text-zinc-500/30" />

            {/* Header */}
            <div className="p-4 border-b border-zinc-900/50 bg-zinc-950/60 backdrop-blur-md flex items-center gap-3 relative z-10">
                <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-zinc-100 transition-colors">
                    <Share2 size={12} />
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">Lineage Stream</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-mono text-zinc-600 uppercase">Live_Telemetry</span>
                    </div>
                </div>
                <div className="ml-auto opacity-20 group-hover:opacity-100 transition-opacity">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                </div>
            </div>

            {/* Content Swarm */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
                <AnimatePresence initial={false}>
                    {filteredEvents.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-30 text-center space-y-3">
                            <div className="relative">
                                <Activity size={32} className="neural-pulse" />
                                <div className="absolute inset-0 bg-zinc-500 blur-xl opacity-10 animate-pulse" />
                            </div>
                            <p className="text-[10px] uppercase tracking-[0.2em] leading-relaxed">
                                Awaiting Sub-Agent<br />Signal Packets...
                            </p>
                        </div>
                    )}
                    {filteredEvents.map(event => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: 10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            whileHover={{ x: 4 }}
                            className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-3 space-y-2 hover:bg-zinc-900/60 hover:border-zinc-700/50 transition-all shadow-lg hover:shadow-black/40 group/card"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover/card:bg-emerald-500 transition-colors" />
                                    <span className="text-[10px] font-bold text-zinc-200 tracking-wider">
                                        NODE_{event.agentId.split('-')[0].toUpperCase()}
                                    </span>
                                </div>
                                <span className="text-[9px] font-mono text-zinc-600 group-hover/card:text-zinc-400 transition-colors">
                                    {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>

                            <div className="text-[11px] text-zinc-500 leading-relaxed font-medium group-hover/card:text-zinc-300 transition-colors line-clamp-3">
                                {event.text}
                            </div>

                            {event.lineage.length > 0 && (
                                <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/30">
                                    <ChevronRight size={10} className="text-zinc-700 shrink-0" />
                                    <span className="text-[9px] font-mono text-zinc-700 group-hover/card:text-zinc-500 truncate transition-colors">
                                        {event.lineage.join(' > ')}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer Status */}
            <div className="p-3 border-t border-zinc-900/80 bg-zinc-950/80 backdrop-blur-md relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-3.5 h-3.5 rounded-full bg-zinc-800 border-2 border-zinc-950" />
                        ))}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tighter">Active_Streams: 03</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500/60 uppercase">
                    <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
                    <span>Hooked</span>
                </div>
            </div>
        </div>
    );
};
