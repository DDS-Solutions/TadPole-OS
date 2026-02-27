import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, User, Users, FileText, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '../services/agentStore';
import { useSovereignStore } from '../services/sovereignStore';
import clsx from 'clsx';

interface CommandItem {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    category: 'Agent' | 'Page' | 'Action';
    action: () => void;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { agents } = useAgentStore();
    const { setSelectedAgentId, setScope } = useSovereignStore();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    const items: CommandItem[] = [
        ...agents.map(agent => ({
            id: `agent-${agent.id}`,
            title: agent.name,
            description: agent.role,
            icon: User,
            category: 'Agent' as const,
            action: () => {
                setSelectedAgentId(agent.id);
                setScope('agent');
                onClose();
            }
        })),
        { id: 'page-ops', title: 'Operations Center', description: 'Main Dashboard', icon: Zap, category: 'Page', action: () => { navigate('/'); onClose(); } },
        { id: 'page-org', title: 'Agent Hierarchy', description: 'Organizational Chart', icon: Users, category: 'Page', action: () => { navigate('/org-chart'); onClose(); } },
        { id: 'page-caps', title: 'Skills & Workflows', description: 'Capabilities Hub', icon: Settings, category: 'Page', action: () => { navigate('/capabilities'); onClose(); } },
        { id: 'action-clear', title: 'Clear Chat History', description: 'Reset all conversations', icon: FileText, category: 'Action', action: () => { useSovereignStore.getState().clearHistory(); onClose(); } },
    ];

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
                e.preventDefault();
            } else if (e.key === 'Enter') {
                filteredItems[selectedIndex]?.action();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden"
                    >
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
                            <Search className="text-zinc-500" size={20} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search agents, pages, or commands..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-100 placeholder:text-zinc-600 font-medium"
                            />
                            <div className="px-1.5 py-0.5 rounded border border-zinc-800 text-[10px] text-zinc-600 font-mono">
                                ESC
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                            {filteredItems.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onClick={item.action}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                                            index === selectedIndex ? "bg-zinc-800/80 text-zinc-100 shadow-inner" : "text-zinc-400 hover:text-zinc-200"
                                        )}
                                    >
                                        <div className={clsx(
                                            "p-2 rounded-lg transition-colors",
                                            index === selectedIndex ? "bg-zinc-700 text-blue-400" : "bg-zinc-950 text-zinc-600"
                                        )}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold truncate">{item.title}</div>
                                            <div className="text-[10px] text-zinc-600 font-medium truncate uppercase tracking-wider">{item.description}</div>
                                        </div>
                                        <div className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest">{item.category}</div>
                                    </button>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <div className="p-12 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1"><Command size={10} /> + K to close</span>
                                <span className="flex items-center gap-1">↑↓ to navigate</span>
                                <span className="flex items-center gap-1">ENTER to select</span>
                            </div>
                            <span className="text-zinc-800">Tadpole OS Sovereign Hub</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
