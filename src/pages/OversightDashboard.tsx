import { useEffect, useState } from 'react';
import {
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    Target,
    AlertTriangle,
    Activity,
    Terminal as TerminalIcon,
    Search,
    Cpu,
    Plus,
    WifiOff
} from 'lucide-react';
import { useSettingsStore } from '../services/settingsStore';
import { useEngineStatus } from '../hooks/useEngineStatus';
import { useWorkspaceStore } from '../services/workspaceStore';
import { agents as allAgents } from '../data/mockAgents';
import { MOCK_PENDING, MOCK_LEDGER, type OversightEntry, type LedgerEntry } from '../data/mockOversight';
import { CommandTable } from '../components/CommandTable';

// Types mirrored from server/types.ts
// Types are now imported from ../data/mockOversight

export default function OversightDashboard() {
    const { isOnline } = useEngineStatus();
    const { settings } = useSettingsStore();
    const [pending, setPending] = useState<OversightEntry[]>([]);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [filter, setFilter] = useState('');
    const [isSimulated, setIsSimulated] = useState(false);
    const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
    const [selectedClusterId, setSelectedClusterId] = useState<string>('all');
    const { clusters, activeProposals } = useWorkspaceStore();

    // Persistence: Load from localStorage on mount
    useEffect(() => {
        const savedPending = localStorage.getItem('tadpole_oversight_pending');
        const savedLedger = localStorage.getItem('tadpole_oversight_ledger');

        if (savedPending) {
            try { setPending(JSON.parse(savedPending)); } catch (_e) { /* ignored */ }
        }
        if (savedLedger) {
            try { setLedger(JSON.parse(savedLedger)); } catch (_e) { /* ignored */ }
        }
    }, []);

    // Persistence: Save to localStorage on change
    useEffect(() => {
        if (pending.length > 0 || hasAttemptedFetch) {
            localStorage.setItem('tadpole_oversight_pending', JSON.stringify(pending));
        }
    }, [pending, hasAttemptedFetch]);

    useEffect(() => {
        if (ledger.length > 0 || hasAttemptedFetch) {
            localStorage.setItem('tadpole_oversight_ledger', JSON.stringify(ledger));
        }
    }, [ledger, hasAttemptedFetch]);

    // Poll for data (WebSocket would be better, but polling is simpler for Phase 3 start)
    useEffect(() => {
        const fetchData = async () => {
            if (isSimulated) {
                if (pending.length === 0 && !hasAttemptedFetch) {
                    setPending(MOCK_PENDING);
                    setLedger(MOCK_LEDGER);
                }
                updateStats(pending, ledger);
                return;
            }

            try {
                const headers = { 'Authorization': `Bearer ${settings.openClawApiKey || 'tadpole-dev-token-2026'}` };
                const [pendingRes, ledgerRes] = await Promise.all([
                    fetch(`${settings.openClawUrl}/oversight/pending`, { headers }),
                    fetch(`${settings.openClawUrl}/oversight/ledger`, { headers })
                ]);

                if (pendingRes.ok) {
                    const pendingData = await pendingRes.json();
                    setPending(pendingData);
                }
                if (ledgerRes.ok) {
                    const ledgerData = await ledgerRes.json();
                    setLedger(ledgerData);
                    setIsSimulated(false); // We got real data (even if empty)
                }

                // Use the data just fetched to update stats, rather than waiting for next render
                // This is slightly tricky without closure data, so we let the useEffect [ledger, pending] handle it
                setHasAttemptedFetch(true);
            } catch {
                if (!hasAttemptedFetch) {
                    setPending(MOCK_PENDING);
                    setLedger(MOCK_LEDGER);
                    setIsSimulated(true);
                    setHasAttemptedFetch(true);
                }
            }
        };

        const updateStats = (p: OversightEntry[], l: LedgerEntry[]) => {
            setStats({
                pending: p.length,
                approved: l.filter((entry) => entry.decision === 'approved').length,
                rejected: l.filter((entry) => entry.decision === 'rejected').length
            });
        };

        fetchData();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') fetchData();
        }, isSimulated ? 5000 : 2000);
        return () => clearInterval(interval);
    }, [settings.openClawUrl, isSimulated, hasAttemptedFetch]);

    // Separate effect for stats to ensure they always reflect current state
    useEffect(() => {
        setStats({
            pending: pending.length,
            approved: ledger.filter((entry) => entry.decision === 'approved').length,
            rejected: ledger.filter((entry) => entry.decision === 'rejected').length
        });
    }, [pending, ledger]);

    const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
        if (isSimulated) {
            // Simulated local move
            const entry = pending.find(p => p.id === id);
            if (entry) {
                setLedger(prev => [{ ...entry, decision, timestamp: new Date().toISOString() } as LedgerEntry, ...prev]);
                setPending(prev => prev.filter(p => p.id !== id));
            }
            return;
        }

        try {
            await fetch(`${settings.openClawUrl}/oversight/${id}/decide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openClawApiKey || 'tadpole-dev-token-2026'}`
                },
                body: JSON.stringify({ decision })
            });
            // Optimistic update
            setPending(prev => prev.filter(p => p.id !== id));
        } catch {
            // Silently fail, would be logged in a real environment
        }
    };

    const handleKillSwitch = async () => {
        if (!confirm("⚠️ HALT AGENTS: This will stop all running agents but keep the server online. Continue?")) return;

        if (isSimulated) {
            setPending([]);
            return;
        }

        try {
            await fetch(`${settings.openClawUrl}/engine/kill`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.openClawApiKey || 'tadpole-dev-token-2026'}`
                }
            });
            alert("Agents Halted.");
        } catch (e) {
            alert("Failed to halt agents. Check console.");
        }
    };

    const handleKillEngine = async () => {
        if (!confirm("💀 KILL ENGINE: This will shutdown the backend server immediately. You will need to manually restart it. Are you sure?")) return;

        const userInput = prompt("Type 'SHUTDOWN' to confirm:");
        if (userInput !== 'SHUTDOWN') return;

        try {


            const res = await fetch(`${settings.openClawUrl}/engine/shutdown`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openClawApiKey || 'tadpole-dev-token-2026'}`
                }
            });


            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server returned ${res.status}: ${text}`);
            }

            await res.json();
            alert("Engine Shutting Down...");
        } catch (e: any) {
            alert(`Failed to kill engine: ${e.message}`);
        }
    };

    const filteredLedger = ledger
        .filter(l => {
            const matchesCluster = selectedClusterId === 'all' || l.toolCall.clusterId === selectedClusterId;
            const matchesSearch = l.toolCall.agentId.toLowerCase().includes(filter.toLowerCase()) ||
                l.toolCall.skill.toLowerCase().includes(filter.toLowerCase()) ||
                JSON.stringify(l.toolCall.params).toLowerCase().includes(filter.toLowerCase());
            return matchesCluster && matchesSearch;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const filteredPending = pending.filter(p =>
        selectedClusterId === 'all' || p.toolCall.clusterId === selectedClusterId
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Fallback / Simulation Banner */}
            {isSimulated && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-amber-500/20 rounded-lg">
                            <WifiOff size={16} className="text-amber-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-200 uppercase tracking-widest">OpenClaw Disconnected</p>
                            <p className="text-[10px] text-amber-500/70 font-mono">Running Oversight in high-fidelity simulation mode</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSimulated(false)}
                        className="text-[10px] px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-full border border-amber-500/30 transition-colors uppercase font-bold tracking-tighter"
                    >
                        Retry Connection
                    </button>
                </div>
            )}

            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-zinc-400 text-sm">Pending Actions</p>
                        <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500/20" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-zinc-400 text-sm">Approved</p>
                        <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500/20" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-zinc-400 text-sm">Rejected</p>
                        <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500/20" />
                </div>
                <button
                    onClick={handleKillSwitch}
                    className={`p-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors cursor-pointer group border ${isOnline ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-zinc-800/10 border-zinc-700/50 text-zinc-600 opacity-50'}`}
                    disabled={!isOnline}
                >
                    <Shield className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {isOnline ? 'HALT AGENTS' : 'OFFLINE'}
                </button>
                <button
                    onClick={handleKillEngine}
                    className={`p-4 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors cursor-pointer group border ${isOnline ? 'bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-500' : 'bg-zinc-800/10 border-zinc-700/50 text-zinc-600 opacity-50'}`}
                    disabled={!isOnline}
                >
                    <WifiOff className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {isOnline ? 'KILL ENGINE' : 'OFFLINE'}
                </button>
            </div>

            {/* Pending Queue */}
            {pending.length > 0 && (
                <div className="bg-zinc-900 border border-yellow-500/30 rounded-lg overflow-hidden">
                    <div className="bg-yellow-500/10 p-3 border-b border-yellow-500/20 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <h2 className="font-semibold text-yellow-100">Awaiting Approval ({filteredPending.length})</h2>
                    </div>
                    <div className="divide-y divide-zinc-800">
                        {filteredPending.map(entry => (
                            <div key={entry.id} className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                            {entry.toolCall.agentId}
                                        </span>
                                        <span className="text-sm font-medium text-blue-400 flex items-center gap-1">
                                            <TerminalIcon className="w-3 h-3" />
                                            {entry.toolCall.skill}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            {new Date(entry.createdAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-zinc-300">{entry.toolCall.description}</p>
                                    <pre className="text-xs bg-black/50 p-2 rounded text-zinc-400 font-mono overflow-auto max-w-2xl">
                                        {JSON.stringify(entry.toolCall.params, null, 2)}
                                    </pre>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={() => handleDecide(entry.id, 'approved')}
                                        className="flex-1 md:flex-none bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded border border-green-500/30 font-medium transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleDecide(entry.id, 'rejected')}
                                        className="flex-1 md:flex-none bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded border border-red-500/30 font-medium transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Ledger */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <h2 className="font-semibold text-zinc-100">Action Ledger</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Target className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <select
                                value={selectedClusterId}
                                onChange={(e) => setSelectedClusterId(e.target.value)}
                                className="bg-zinc-950 border border-zinc-700 rounded-full pl-9 pr-8 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                            >
                                <option value="all">All Missions</option>
                                {clusters.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Filter actions..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-zinc-950 border border-zinc-700 rounded-full pl-9 pr-4 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-purple-500 w-48"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 font-medium border-b border-zinc-800">Time</th>
                                <th className="p-3 font-medium border-b border-zinc-800">Agent</th>
                                <th className="p-3 font-medium border-b border-zinc-800">Action</th>
                                <th className="p-3 font-medium border-b border-zinc-800">Params</th>
                                <th className="p-3 font-medium border-b border-zinc-800">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredLedger.map(entry => (
                                <tr key={entry.id} className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="p-3 text-zinc-500 whitespace-nowrap font-mono text-xs">
                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="p-3 text-zinc-300 font-medium">
                                        {entry.toolCall.agentId}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${entry.decision === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <span className="font-mono text-blue-400">{entry.toolCall.skill}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 max-w-xs truncate text-zinc-400 font-mono text-xs" title={JSON.stringify(entry.toolCall.params, null, 2)}>
                                        {JSON.stringify(entry.toolCall.params)}
                                    </td>
                                    <td className="p-3">
                                        {entry.decision === 'rejected' ? (
                                            <span className="text-red-400 text-xs uppercase font-bold tracking-wider">Blocked</span>
                                        ) : (
                                            <span className={`text-xs ${entry.result?.success ? 'text-green-400' : 'text-red-400'}`}>
                                                {entry.result?.success ? 'Success' : 'Failed'}
                                                <span className="text-zinc-600 ml-1">({entry.result?.durationMs}ms)</span>
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredLedger.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-600">
                                        No actions recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Swarm Intelligence / Alpha Reasoning (Option A Enhancement) */}
            <div className="bg-zinc-900 border border-blue-500/30 rounded-lg overflow-hidden">
                <div className="bg-blue-500/10 p-3 border-b border-blue-500/20 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <h2 className="font-semibold text-blue-100">Swarm Intelligence Oversight</h2>
                </div>
                <div className="p-6">
                    {Object.values(activeProposals || {}).length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {Object.values(activeProposals).map((proposal) => {
                                const cluster = clusters.find(c => c.id === proposal.clusterId);
                                return (
                                    <div key={proposal.clusterId} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{cluster?.name || 'Unknown Cluster'}</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                ALPHA_NODE_{cluster?.alphaId} • {new Date(proposal.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        <div className="bg-black/40 p-3 rounded-lg border border-zinc-800/50">
                                            <div className="text-[9px] font-bold text-zinc-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                <Activity size={10} /> Neural Reasoning Trace
                                            </div>
                                            <p className="text-xs text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
                                                {proposal.reasoning}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Proposed Reallocations</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {proposal.changes.map(change => {
                                                    const agent = allAgents.find(a => a.id === change.agentId);
                                                    return (
                                                        <div key={change.agentId} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-1.5">
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] font-bold text-zinc-200">{agent?.name}</span>
                                                                <span className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-500 font-mono uppercase">MOD_REQ</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {change.proposedRole && (
                                                                    <div className="flex items-center gap-2 text-[9px]">
                                                                        <span className="text-zinc-600 uppercase">Role:</span>
                                                                        <span className="text-blue-400">{change.proposedRole}</span>
                                                                    </div>
                                                                )}
                                                                {change.proposedModel && (
                                                                    <div className="flex items-center gap-2 text-[9px]">
                                                                        <span className="text-zinc-600 uppercase">Model:</span>
                                                                        <span className="text-purple-400">{change.proposedModel}</span>
                                                                    </div>
                                                                )}
                                                                {change.addedSkills && (
                                                                    <div className="flex items-center gap-2 text-[9px]">
                                                                        <span className="text-zinc-600 uppercase">Skills:</span>
                                                                        <span className="text-emerald-400">+{change.addedSkills.length}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-zinc-600 gap-3 border border-dashed border-zinc-800 rounded-xl">
                            <Plus size={32} className="opacity-10" />
                            <p className="text-xs italic uppercase tracking-widest font-bold">No optimization traces detected</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Neural Footprint Monitoring (Moved from OpsDashboard) */}
            <CommandTable />
        </div>
    );
}
