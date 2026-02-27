import { Activity, ShieldCheck, Zap, HardDrive, Cpu as CpuIcon } from 'lucide-react';
import { useEngineStatus } from '../hooks/useEngineStatus';
import { SectorBoundary } from '../components/ErrorBoundary';

const TelemetryVisualizer = ({ isOnline }: { isOnline: boolean }) => {
    return (
        <div className="grid grid-cols-12 gap-1 h-32 w-full max-w-2xl">
            {[...Array(48)].map((_, i) => (
                <div
                    key={i}
                    className={`h-full rounded-sm transition-all duration-300 ${isOnline ? 'bg-emerald-500/20' : 'bg-zinc-800/10'}`}
                    style={{
                        height: isOnline ? `${20 + Math.random() * 80}%` : '10%',
                        opacity: isOnline ? 0.3 + Math.random() * 0.7 : 0.1
                    }}
                />
            ))}
        </div>
    );
};

/**
 * Real-time monitoring center for the Tadpole Engine.
 * Visualizes high-frequency system telemetry via Neural Pulse event streams.
 */
export default function EngineDashboard() {
    const { isOnline, cpu, memory, latency, connectionState } = useEngineStatus();

    const stats = [
        { label: 'CPU Usage', value: `${cpu.toFixed(1)}%`, icon: CpuIcon, color: cpu > 80 ? 'text-red-400' : 'text-emerald-400' },
        { label: 'Memory', value: `${memory.toFixed(1)}GB`, icon: HardDrive, color: 'text-emerald-400' },
        { label: 'Inference Latency', value: `${latency.toFixed(0)}ms`, icon: Zap, color: latency > 150 ? 'text-yellow-400' : 'text-emerald-400' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl ring-1 ring-zinc-800">
                        <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 italic">Neural Engine Telemetry</h1>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold font-mono">Real-time Stream • OpenClaw v3.2 Protocol</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-widest">{connectionState}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="p-5 border border-zinc-800 rounded-2xl bg-zinc-900/50 backdrop-blur-xl group hover:border-zinc-700 transition-all shadow-lg">
                        <div className="flex justify-between items-start mb-3">
                            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{stat.label}</div>
                            <stat.icon size={14} className="text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                        </div>
                        <div className={`text-3xl font-mono ${stat.color} tracking-tighter`}>{stat.value}</div>
                        <div className="mt-3 flex items-center gap-1.5">
                            <div className={`h-1 w-full rounded-full bg-zinc-800 overflow-hidden`}>
                                <div
                                    className={`h-full bg-current transition-all duration-100 ${stat.color}`}
                                    style={{ width: stat.label === 'CPU Usage' ? `${cpu}%` : stat.label === 'Memory' ? `${(memory / 16) * 100}%` : '50%' }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-8 border border-zinc-800 rounded-3xl bg-zinc-950 relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.05),transparent)] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-2 text-zinc-600 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
                        <ShieldCheck size={12} className="text-emerald-500/50" /> Secure Telemetry Handshake
                    </div>
                    <SectorBoundary name="Telemetry Stream">
                        <TelemetryVisualizer isOnline={isOnline} />
                    </SectorBoundary>
                    <div className="text-center">
                        <p className="text-zinc-100 text-sm font-bold tracking-tighter flex items-center justify-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            NEURAL PROCESSING CLUSTER
                        </p>
                        <p className="text-zinc-600 text-[10px] mt-1 font-mono uppercase tracking-[0.2em]">Node: TADPOLE-OS-CORE-01 • {isOnline ? 'Active Stream' : 'Offline'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
