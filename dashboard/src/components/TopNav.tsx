import { Activity, ShieldCheck, Database, Server, Radio, Play } from 'lucide-react';
import type { ConnectionStatus } from '../lib/liveStream';

interface TopNavProps {
  isLive: boolean;
  setIsLive: (val: boolean) => void;
  wsStatus: ConnectionStatus;
}

export function TopNav({ isLive, setIsLive, wsStatus }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center px-6 gap-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-purple/20 border border-neon-purple/50">
            <ShieldCheck className="h-6 w-6 text-neon-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              Sentinel<span className="text-neon-purple">Command</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Global Interdiction Grid
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
          {/* Connection Mode Controls */}
          <div className="flex items-center gap-2 border-r border-slate-800 pr-6 mr-2">
            <button
              onClick={() => setIsLive(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                !isLive 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' 
                  : 'text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              SIMULATION
            </button>
            
            <button
              onClick={() => setIsLive(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                isLive 
                  ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/35' 
                  : 'text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              LIVE KAFKA
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            {isLive ? (
              <StatusIndicator 
                icon={<Radio className="h-4 w-4" />} 
                label="Streaming Bridge" 
                status={
                  wsStatus === 'CONNECTED' 
                    ? 'operational' 
                    : wsStatus === 'CONNECTING' 
                      ? 'connecting' 
                      : 'disconnected'
                } 
              />
            ) : (
              <StatusIndicator icon={<Play className="h-4 w-4" />} label="Local Simulation" status="standby" />
            )}
            <StatusIndicator icon={<Activity className="h-4 w-4" />} label="API Gateway" status="operational" />
            <StatusIndicator icon={<Server className="h-4 w-4" />} label="Kafka Cluster" status="operational" />
            <StatusIndicator icon={<Database className="h-4 w-4" />} label="Redis Cache" status="operational" />
          </div>
        </div>
      </div>
    </nav>
  );
}

function StatusIndicator({ icon, label, status }: { icon: React.ReactNode; label: string; status: 'operational' | 'degraded' | 'standby' | 'connecting' | 'disconnected' }) {
  const colors = {
    operational: 'text-emerald-safe bg-emerald-safe/10 border-emerald-safe/20',
    degraded: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    standby: 'text-neon-purple bg-neon-purple/10 border-neon-purple/20',
    connecting: 'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse',
    disconnected: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };

  const pulse = status === 'operational' ? 'animate-pulse' : '';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[status]}`}>
      {icon}
      <span className="uppercase tracking-wider">{label}</span>
      <div className={`h-1.5 w-1.5 rounded-full bg-current ${pulse}`} />
    </div>
  );
}
