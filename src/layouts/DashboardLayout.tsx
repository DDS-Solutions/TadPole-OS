import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Target, Mic, FolderOpen, BookOpen, Settings, Command, Shield, Cpu, Activity, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { openClawSocket, type ConnectionState } from '../services/openclawSocket';
import { SovereignChat } from '../components/SovereignChat';
import { LineageStream } from '../components/LineageStream';
import { CommandPalette } from '../components/CommandPalette';
import logo from '../assets/logo.png';

/**
 * The primary layout component for the application.
 * Features a persistent sidebar for navigation and a main content area for page views.
 */
export default function DashboardLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [engineHealth, setEngineHealth] = useState<{ uptime: number; agentCount: number } | null>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // ── Connection Status ──────────────────────────────────
    useEffect(() => {
        openClawSocket.connect();
        const unsubscribeStatus = openClawSocket.subscribeStatus((state) => {
            setConnectionState(state);
            if (state !== 'connected') setEngineHealth(null);
        });
        const unsubscribeHealth = openClawSocket.subscribeHealth((health) => {
            setEngineHealth({ uptime: health.uptime || 0, agentCount: health.agentCount || 0 });
        });
        return () => {
            unsubscribeStatus();
            unsubscribeHealth();
        };
    }, []);

    // ── Keyboard Shortcuts ──────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === '/')) {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
                return;
            }

            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const routes: Record<string, string> = {
                    '1': '/',
                    '2': '/org-chart',
                    '3': '/standups',
                    '4': '/workspaces',
                    '5': '/docs',
                    '6': '/settings',
                };
                if (routes[e.key]) {
                    navigate(routes[e.key]);
                    return;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    const navItemClass = ({ isActive }: { isActive: boolean }) => clsx(
        "flex items-center gap-3 p-2 rounded-md font-medium cursor-pointer transition-all duration-200 text-sm",
        isActive
            ? "bg-zinc-800 text-zinc-100 shadow-inner border border-zinc-700/50"
            : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
    );

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased selection:bg-zinc-700/30">
            {/* Sidebar */}
            <aside className="w-16 lg:w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col z-20 transition-all duration-300">
                <div className="p-4 lg:p-6 border-b border-zinc-800 flex items-center gap-3 justify-center lg:justify-start">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-zinc-900/50 border border-zinc-800 shrink-0 shadow-lg group">
                        <img src={logo} alt="Tadpole OS Logo" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    <span className="font-bold text-lg tracking-tight hidden lg:block text-zinc-100">Tadpole OS</span>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-4">
                    <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 px-2 hidden lg:block">Modules</div>
                    <NavLink to="/" end className={navItemClass} title="Ops Dashboard">
                        <LayoutDashboard size={18} />
                        <span className="hidden lg:block">Operations</span>
                    </NavLink>
                    <NavLink to="/org-chart" className={navItemClass} title="Org Chart">
                        <Users size={18} />
                        <span className="hidden lg:block">Hierarchy</span>
                    </NavLink>
                    <NavLink to="/missions" className={navItemClass} title="Missions">
                        <Target size={18} />
                        <span className="hidden lg:block">Missions</span>
                    </NavLink>
                    <NavLink to="/oversight" className={navItemClass} title="Oversight">
                        <Shield size={18} />
                        <span className="hidden lg:block">Oversight</span>
                    </NavLink>
                    <NavLink to="/standups" className={navItemClass} title="Standups">
                        <Mic size={18} />
                        <span className="hidden lg:block">Voice & Chat Comms</span>
                    </NavLink>
                    <NavLink to="/workspaces" className={navItemClass} title="Workspaces">
                        <FolderOpen size={18} />
                        <span className="hidden lg:block">Workspaces</span>
                    </NavLink>
                    <NavLink to="/models" className={navItemClass} title="AI Provider Manager">
                        <Cpu size={18} />
                        <span className="hidden lg:block">AI Provider Manager</span>
                    </NavLink>
                    <NavLink to="/agents" className={navItemClass} title="Agent Swarm Manager">
                        <Users size={18} />
                        <span className="hidden lg:block">Agent Swarm Manager</span>
                    </NavLink>
                    <NavLink to="/capabilities" className={navItemClass} title="Skills & Workflows">
                        <Wrench size={18} />
                        <span className="hidden lg:block">Skills & Workflows</span>
                    </NavLink>
                    <NavLink to="/engine" className={navItemClass} title="Engine Dashboard">
                        <Activity size={18} />
                        <span className="hidden lg:block">Engine Dashboard</span>
                    </NavLink>
                    <div className="my-4 border-t border-zinc-800 mx-2"></div>
                    <NavLink to="/docs" className={navItemClass} title="Documentation">
                        <BookOpen size={18} />
                        <span className="hidden lg:block">System Docs</span>
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <NavLink to="/settings" className={({ isActive }) => clsx(
                        "flex items-center gap-3 p-2 rounded-md font-medium cursor-pointer transition-all duration-200 text-sm justify-center lg:justify-start",
                        isActive ? "bg-zinc-800 text-zinc-100 shadow-inner border border-zinc-700/50" : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                    )} title="Settings">
                        <Settings size={18} />
                        <span className="hidden lg:block">Settings</span>
                    </NavLink>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
                {/* Header */}
                <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                        <span className="bg-zinc-900 px-2 py-1 rounded text-[10px] font-mono border border-zinc-800 text-zinc-400">
                            v2.4.0-stable
                        </span>
                        <span className="hidden md:inline text-zinc-700">/</span>
                        <span className="text-zinc-200 font-medium truncate">
                            {location.pathname === '/' && 'Operations Center'}
                            {location.pathname === '/org-chart' && 'Agent Hierarchy Layer'}
                            {location.pathname === '/missions' && 'Mission Management'}
                            {location.pathname === '/standups' && 'Voice Interface'}
                            {location.pathname === '/workspaces' && 'Workspace Manager'}
                            {location.pathname === '/models' && 'AI Provider Manager'}
                            {location.pathname === '/engine' && 'System Telemetry'}
                            {location.pathname === '/oversight' && 'Oversight & Compliance'}
                            {location.pathname === '/agents' && 'Agent Swarm Manager'}
                            {location.pathname === '/capabilities' && 'Skills & Workflows'}
                            {location.pathname === '/docs' && 'Knowledge Base'}
                            {location.pathname === '/settings' && 'System Configuration'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="flex h-2 w-2 relative">
                                {connectionState === 'connected' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                )}
                                {connectionState === 'connecting' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${connectionState === 'connected' ? 'bg-emerald-500' :
                                    connectionState === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                                    }`}></span>
                            </span>
                            <span className={`font-mono font-medium ${connectionState === 'connected' ? 'text-emerald-500' :
                                connectionState === 'connecting' ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                {connectionState === 'connected' ? (
                                    engineHealth ? `ONLINE • ${engineHealth.agentCount} AGENTS` : 'ENGINE ONLINE'
                                ) : connectionState === 'connecting' ? 'CONNECTING...' : 'ENGINE OFFLINE'}
                            </span>
                        </div>
                        <div className="hidden md:flex items-center gap-1 text-[10px] text-zinc-600 font-mono border border-zinc-800 rounded px-1.5 py-0.5">
                            <Command size={10} /> K
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 p-6 pb-12 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        <Outlet />
                    </div>
                    <LineageStream />
                </div>

                <SovereignChat />
                <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setIsCommandPaletteOpen(false)}
                />
            </main>
        </div>
    )
}
